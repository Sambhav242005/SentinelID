# SentinelID

## Description

This is a Flask-based web application for managing user identities. It provides a simple interface to handle user data and integrates with the OpenRouter API for additional functionalities. The application uses a SQLite database through Flask-SQLAlchemy for data persistence.

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

5.  **Set up environment variables:**
    Create a `.env` file in the root directory and add the necessary environment variables. For example:
    ```
    SECRET_KEY='your_secret_key'
    OPENROUTER_API_KEY='your_openrouter_api_key'
    ```



## Usage

To run the application, use the following command:

```bash
python app.py
```

The application will be available at `http://127.0.0.1:5000`.

## Key Dependencies

This project relies on the following major libraries:

-   **Flask:** A micro web framework for Python.
-   **Flask-SQLAlchemy:** An extension for Flask that adds support for SQLAlchemy.
-   **OpenAI:** The Python client library used to interact with the OpenRouter API.
-   **python-dotenv:** Reads key-value pairs from a `.env` file and sets them as environment variables.
-   **requests:** A simple, yet elegant, HTTP library.
-   **Playwright:** A Python library to automate Chromium, Firefox and WebKit browsers.

Please refer to `requirements.txt` for a full list of dependencies.
