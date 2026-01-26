# Dockerfile for FormWiz with LaTeX support
# This image includes Node.js and LaTeX (pdflatex) for PDF generation

FROM node:18-slim

# Install LaTeX and required packages
# Using texlive-base for smaller image size (you can use texlive-full for complete LaTeX)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    texlive-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]



