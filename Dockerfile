# Use the official Node.js image as the base image
FROM node:14

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Define environment variables (these should be replaced with actual values or set through a secure method)
ENV NYT_API_KEY = GbUEFjSqQuHJvxctObguPr0xk5Om3mzX
ENV SLACK_TOKEN=xoxb-6273699442-7206004974307-zCRlzKk3g4yfyoMx4TZE2Gbf
ENV SLACK_CHANNEL=editorial
ENV NOTION_TOKEN=secret_TiaOdQ8Z0TZGcbYdRiE2ZcUkwHesjrUG6sjQGlEKCXR
ENV DATABASE_ID=84dff9d060fe433197fc4a332bdfc82d

# Command to run the application
CMD ["node", "main.js"]
