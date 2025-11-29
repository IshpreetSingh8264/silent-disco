/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                retro: {
                    bg: '#121212',
                    surface: '#1E1E1E',
                    primary: '#BB86FC',
                    secondary: '#03DAC6',
                    error: '#CF6679',
                    neon: '#00ff41', // Matrix green/neon
                }
            },
            fontFamily: {
                retro: ['"Press Start 2P"', 'cursive'], // Example retro font
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
