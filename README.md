# SentinelID

## Description

This is a Flask-based web application for managing user identities. It provides a simple interface to handle user data and integrates with the OpenRouter API for additional functionalities. The application uses a SQLite database through Flask-SQLAlchemy for data persistence.

## 🚀 Live Deployment

You can access the live version of the project at:

**[https://ds.sambhav-surana.online](https://ds.sambhav-surana.online)**

## Installation

Follow these steps to set up the project locally.

### Prerequisites

- Python 3.x
- `pip` package manager

### Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Sambhav242005/SentinelID.git
    cd SentinelID
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```
    On Windows, use:
    ```bash
    venv\Scripts\activate
    ```

3.  **Install the dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Install Playwright browsers:**
    This is required for the browser automation features.
    ```bash
    playwright install
    ```

5.  **Install additional system dependencies (if needed):**
    For video streaming capabilities, you may need to install system-level dependencies:
    - **Windows**: The required packages are included in the requirements.txt
    - **Linux**: `sudo apt-get install libavcodec-dev libavformat-dev libswscale-dev`
    - **macOS**: `brew install ffmpeg`

5.  **Set up environment variables:**
    Create a `.env` file in the root directory and add the necessary environment variables. For example:
    ```
    SECRET_KEY='your_secret_key'
    OPENROUTER_API_KEY='your_openrouter_api_key'
    ```

## Features

- **User Authentication**: Secure login and registration system
- **Session Management**: Create, manage, and monitor browser sessions
- **Browser Automation**: Real-time browser control with WebRTC streaming
- **Session Persistence**: Save and restore browser sessions
- **Real-time Interaction**: Click, type, scroll, and navigate in browser sessions
- **WebRTC Support**: Live video streaming of browser sessions
- **RESTful API**: Comprehensive API endpoints for easy integration
- **Isolated Sessions**: Secure, sandboxed browser environments

## Usage

To run the application, use the following command:

```bash
python app.py
```

The application will be available at `http://127.0.0.1:5000`.

## API Endpoints

### Session Management

- `POST /sessions` - Create a new browser session
- `GET /sessions` - List all active sessions
- `DELETE /sessions/<session_id>` - Delete a specific session
- `POST /sessions/<session_id>/save` - Save a session for later restoration
- `GET /sessions/saved` - List all saved sessions
- `POST /sessions/<saved_id>/restore` - Restore a saved session

### WebRTC Streaming

- `POST /webrtc/offer` - Initialize WebRTC connection
- `POST /webrtc/candidate` - Add ICE candidate to WebRTC connection

### Utility Endpoints

- `GET /health` - Health check endpoint
- `GET /session/isolated_session` - Get isolated session template

## Key Dependencies

This project relies on the following major libraries:

-   **Flask:** A micro web framework for Python.
-   **Flask-SQLAlchemy:** An extension for Flask that adds support for SQLAlchemy.
-   **Flask-CORS:** Cross-Origin Resource Sharing support for Flask applications.
-   **Playwright:** A Python library to automate Chromium, Firefox and WebKit browsers.
-   **aiortc:** WebRTC library for real-time communication and video streaming.
-   **Pillow (PIL):** Python Imaging Library for image processing.
-   **PyAV:** Pythonic bindings for FFmpeg, providing video and audio processing.
-   **requests:** A simple, yet elegant, HTTP library.

Please refer to `requirements.txt` for a full list of dependencies.
