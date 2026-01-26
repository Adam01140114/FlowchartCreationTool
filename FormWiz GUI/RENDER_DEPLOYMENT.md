# Render Deployment Guide for FormWiz with LaTeX Support

## Problem
The LaTeX to PDF conversion fails on Render because `pdflatex` is not installed by default on Render's servers.

## Solution
Use the provided Dockerfile which includes LaTeX pre-installed.

## Deployment Steps on Render

### Option 1: Using Dockerfile (Recommended)

1. **In your Render dashboard:**
   - Go to your Web Service
   - Click "Settings"
   - Under "Build Command", leave it empty (Dockerfile handles this)
   - Under "Start Command", leave it empty (Dockerfile handles this)
   - Make sure "Docker" is selected as the build method

2. **The Dockerfile will:**
   - Install Node.js 18
   - Install LaTeX (texlive-base, texlive-latex-extra, texlive-fonts-recommended)
   - Install your npm dependencies
   - Start your server

### Option 2: Using Build Script (Alternative)

If you prefer not to use Docker, you can add LaTeX installation to your build script:

1. **Create a `build.sh` file:**
```bash
#!/bin/bash
# Install LaTeX
apt-get update
apt-get install -y texlive-base texlive-latex-extra texlive-fonts-recommended

# Install Node.js dependencies
npm install --production
```

2. **In Render dashboard:**
   - Set "Build Command" to: `chmod +x build.sh && ./build.sh`
   - Set "Start Command" to: `node server.js`

**Note:** This approach may be slower and may hit Render's build time limits.

## Verify Installation

After deployment, check your Render logs. You should see:
```
✓ pdflatex is available
```

If you see a warning instead, LaTeX is not installed and PDF generation will fail.

## Testing

1. Deploy your service
2. Test the LaTeX preview feature in your form
3. Check Render logs for any LaTeX compilation errors

## Troubleshooting

### Error: "pdflatex is not installed"
- Make sure you're using the Dockerfile deployment method
- Check that the Dockerfile is in the root of your repository
- Verify that Render is using Docker for deployment

### Error: "LaTeX compilation failed"
- Check Render logs for detailed LaTeX error messages
- Verify your LaTeX template syntax
- Check that all required LaTeX packages are included in the Dockerfile

### Build Timeout
- The Dockerfile uses `texlive-base` which is smaller than `texlive-full`
- If you need more LaTeX packages, add them to the Dockerfile's `apt-get install` command

## Dockerfile Customization

If you need additional LaTeX packages, modify the Dockerfile:

```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    texlive-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-science \  # Add this for scientific packages
    && rm -rf /var/lib/apt/lists/*
```

## Notes

- The Dockerfile uses `node:18-slim` for a smaller image size
- LaTeX installation adds ~200-300MB to the image size
- First build may take longer due to LaTeX installation
- Subsequent builds will be faster if Docker layers are cached



