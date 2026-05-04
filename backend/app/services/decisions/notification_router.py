"""
Notification Router  dispatches decisions to Slack, email, and webhooks.

All channels are optional and gracefully no-op when not configured.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict
from typing import TYPE_CHECKING, Dict

if TYPE_CHECKING:
    from .alert_engine import Decision

logger = logging.getLogger(__name__)

SEVERITY_EMOJI = {
    "info":     ":information_source:",
    "warning":  ":warning:",
    "high":     ":large_orange_circle:",
    "critical": ":red_circle:",
}


class NotificationRouter:

    async def dispatch(self, channel: str, decision: "Decision") -> bool:
        """Route a decision to the specified notification channel."""
        handlers = {
            "slack":   self._slack,
            "email":   self._email,
            "webhook": self._webhook,
        }
        handler = handlers.get(channel)
        if not handler:
            logger.warning("Unknown notification channel: %s", channel)
            return False
        try:
            return await handler(decision)
        except Exception as exc:
            logger.error("notification dispatch failed channel=%s: %s", channel, exc)
            return False

    #  Slack 

    async def _slack(self, decision: "Decision") -> bool:
        webhook_url = os.getenv("SLACK_WEBHOOK_URL")
        if not webhook_url:
            logger.debug("SLACK_WEBHOOK_URL not set  skipping Slack notification")
            return False

        emoji   = SEVERITY_EMOJI.get(decision.severity, ":bell:")
        channel = os.getenv("SLACK_CHANNEL", "#alerts")

        findings_text = "\n".join(
            f"   {f.get('type', '')}: {f.get('value', '')}"
            for f in decision.findings[:5]
        )
        recs_text = "\n".join(
            f"   [{r.get('priority', '').upper()}] {r.get('action', '')}"
            for r in decision.recommended_actions[:3]
        )

        payload = {
            "channel": channel,
            "text":    f"{emoji} *APEX Alert  {decision.severity.upper()}*",
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"{emoji} {decision.title}"},
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Severity:* {decision.severity.upper()}"},
                        {"type": "mrkdwn", "text": f"*Source:* {decision.source_type}"},
                        {"type": "mrkdwn", "text": f"*Status:* {decision.status}"},
                        {"type": "mrkdwn", "text": f"*Confidence:* {decision.confidence:.0%}"},
                    ],
                },
            ],
        }
        if findings_text:
            payload["blocks"].append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Key Findings:*\n{findings_text}"},
            })
        if recs_text:
            payload["blocks"].append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Recommendations:*\n{recs_text}"},
            })
        if decision.description:
            payload["blocks"].append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": decision.description[:300]},
            })

        return await self._http_post(webhook_url, payload)

    #  Email 

    async def _email(self, decision: "Decision") -> bool:
        smtp_host  = os.getenv("SMTP_HOST")
        smtp_port  = int(os.getenv("SMTP_PORT", "587"))
        smtp_user  = os.getenv("SMTP_USER")
        smtp_pass  = os.getenv("SMTP_PASSWORD")
        to_address = os.getenv("ALERT_EMAIL_TO")

        if not all([smtp_host, smtp_user, smtp_pass, to_address]):
            logger.debug("SMTP not configured  skipping email notification")
            return False

        try:
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            subject = f"[APEX {decision.severity.upper()}] {decision.title}"
            body = self._render_email_body(decision)

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"]    = smtp_user
            msg["To"]      = to_address
            msg.attach(MIMEText(body, "html"))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, to_address, msg.as_string())

            logger.info("email_sent to=%s subject='%s'", to_address, subject)
            return True

        except Exception as exc:
            logger.error("email dispatch failed: %s", exc)
            return False

    def _render_email_body(self, decision: "Decision") -> str:
        severity_color = {
            "info": "#3b82f6", "warning": "#f59e0b",
            "high": "#f97316", "critical": "#ef4444",
        }.get(decision.severity, "#6b7280")

        findings_html = "".join(
            f"<li><strong>{f.get('type','')}</strong>: {f.get('value','')}</li>"
            for f in decision.findings[:5]
        )
        recs_html = "".join(
            f"<li>[{r.get('priority','').upper()}] {r.get('action','')}</li>"
            for r in decision.recommended_actions[:3]
        )

        return f"""
        <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:{severity_color};color:white;padding:16px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">APEX Intelligence Alert</h2>
            <p style="margin:4px 0 0">{decision.severity.upper()}  {decision.title}</p>
        </div>
        <div style="padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
            <p>{decision.description}</p>
            {"<h3>Key Findings</h3><ul>" + findings_html + "</ul>" if findings_html else ""}
            {"<h3>Recommendations</h3><ul>" + recs_html + "</ul>" if recs_html else ""}
            <hr style="margin:20px 0"><p style="color:#6b7280;font-size:12px">
            Source: {decision.source_type} | Confidence: {decision.confidence:.0%}
            </p>
        </div></body></html>"""

    #  Generic Webhook 

    async def _webhook(self, decision: "Decision") -> bool:
        url = os.getenv("WEBHOOK_URL")
        if not url:
            logger.debug("WEBHOOK_URL not set  skipping webhook")
            return False
        payload = {
            "event":    "apex.decision",
            "decision": asdict(decision),
        }
        return await self._http_post(url, payload)

    #  HTTP helper 

    async def _http_post(self, url: str, payload: Dict) -> bool:
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    ok = resp.status < 300
                    if not ok:
                        logger.warning("http_post %s  %d", url, resp.status)
                    return ok
        except ImportError:
            # aiohttp not installed  fall back to urllib
            import urllib.request
            data = json.dumps(payload).encode()
            req = urllib.request.Request(url, data=data,
                                         headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    return r.status < 300
            except Exception:
                return False
        except Exception as exc:
            logger.error("http_post failed %s: %s", url, exc)
            return False


# Singleton
notification_router = NotificationRouter()

