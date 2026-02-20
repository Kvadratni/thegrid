# The Grid - Project Automation

# Default recipe to list available commands
default:
    @just --list

# Start both the backend server and frontend UI concurrently
dev:
    @echo "Starting The Grid (Press Ctrl+C to stop)..."
    @npx concurrently -c "green,blue" -n "server,client" "cd server && npm run dev" "cd client && npm run dev"

# Start the backend server only
server:
    @echo "Starting backend server..."
    cd server && npm run dev

# Start the frontend UI only
client:
    @echo "Starting frontend UI..."
    cd client && npm run dev

# Install dependencies for both server and client
install:
    @echo "Installing backend dependencies..."
    cd server && npm install
    @echo "Installing frontend dependencies..."
    cd client && npm install

# Build both components
build:
    @echo "Building backend..."
    cd server && npm run build
    @echo "Building frontend..."
    cd client && npm run build
