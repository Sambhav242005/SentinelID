# Project Overview

This is a full-stack web application named SentinelID. The backend is built with Flask, a Python micro web framework, and it uses Flask-SQLAlchemy for database interactions with a SQLite database. The backend handles user identity management and integrates with the OpenRouter API. The frontend is a Next.js application, written in TypeScript, and styled with Tailwind CSS.

# Building and Running

## Backend (Flask)

1.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Run the application:**
    ```bash
    python app.py
    ```

The backend will be running at `http://127.0.0.1:5000`.

## Frontend (Next.js)

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

The frontend will be available at `http://localhost:3000`.

# Development Conventions

*   **Backend:** The backend follows standard Flask application structure. Routes are defined in the `routes` directory, models in the `models` directory, and configuration in `config.py`.
*   **Frontend:** The frontend uses Next.js with TypeScript and Tailwind CSS. Components are located in `src/components`. The main page is `src/app/page.tsx`.
*   **API Interaction:** The frontend likely interacts with the backend API to fetch and display data. The file `src/lib/api.ts` seems to be intended for this purpose.
