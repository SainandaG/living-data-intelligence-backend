export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#0de7f2",
                "secondary": "#a855f7",
                "background-light": "#f5f8f8",
                "background-dark": "#0a1212",
                "glass-border": "rgba(13, 231, 242, 0.15)",
                "surface": "#1e293b",
            },
            fontFamily: {
                "display": ["Space Grotesk", "sans-serif"],
                "mono": ["Space Mono", "monospace"],
            },
            boxShadow: {
                "glow": "0 0 10px rgba(13, 231, 242, 0.5)",
            },
            borderRadius: {
                "xl": "0.75rem",
                "2xl": "1rem",
            }
        },
    },
    plugins: [],
}
