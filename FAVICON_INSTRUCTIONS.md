# Favicon instructions

I added a reference to `./favicon.png` in each of the OTP HTML files so the browser will show the favicon when opening them:

- `test_otp_user.html`
- `test_otp_user_professional.html`
- `test_otp_admin.html`
- `test_otp_admin_professional.html`

## What you need to do next

1. Save the provided image (the one you attached) as `favicon.png` in the project root: the same folder as the HTML files (project root of this repo).

   - Path: `e:/bz final/bzbackfinal/favicon.png`

2. If you prefer another path, update the `href` in the `<link rel="icon">` tag inside each HTML file to point to the correct location.

## Notes

- I put `type="image/png"` on the link tag. If your provided image is an SVG or ICO change the `type` and filename accordingly (e.g., `favicon.ico`).
- If you want me to add the actual binary image into the repo under `favicon.png`, upload the image file into the workspace or tell me to create it and I will add it for you.

## Done

After you place `favicon.png` at the path above, open any of the OTP HTML files in a browser and you should see the favicon in the tab.
