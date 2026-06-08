/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				terminal: {
					green: '#00ff46',
					amber: '#ffb000',
					cyan:  '#00e5ff',
					white: '#e8ffe8',
					dim:   '#3a6b3a',
					bg:    '#050e05'
				}
			},
			fontFamily: {
				mono: ['JetBrains Mono', 'Courier New', 'monospace']
			}
		}
	},
	plugins: []
};
