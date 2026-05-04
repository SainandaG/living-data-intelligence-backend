import pyotp  # type: ignore
import qrcode
import io
import base64

class MFAService:
    @staticmethod
    def generate_mfa_secret() -> str:
        """Generate a random base32 secret for TOTP."""
        return pyotp.random_base32()

    @staticmethod
    def get_provisioning_uri(user_email: str, secret: str, issuer_name: str = "LivingData") -> str:
        """Generate a provisioning URI for authenticator apps."""
        return pyotp.totp.TOTP(secret).provisioning_uri(name=user_email, issuer_name=issuer_name)

    @staticmethod
    def get_qr_code_base64(provisioning_uri: str) -> str:
        """Generate a base64 encoded QR code image from a provisioning URI."""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode()

    @staticmethod
    def verify_otp(secret: str, code: str) -> bool:
        """Verify a TOTP code against a secret."""
        totp = pyotp.totp.TOTP(secret)
        return totp.verify(code)

mfa_service = MFAService()
