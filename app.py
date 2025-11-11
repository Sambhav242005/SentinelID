import threading
from flask import Flask
from flask_cors import CORS
from config import config
from models import db
from routes import main_blueprint


def create_app():
    app = Flask(__name__)
    app.config.from_object(config)
    
    # Initialize SQLAlchemy
    db.init_app(app)

    # --- ✅ Enable CORS ---
    # Allow both local development and production frontend domains
    CORS(app, resources={r"/*": {"origins": "*"}})

    # --- ✅ Register Blueprints ---
    app.register_blueprint(main_blueprint, url_prefix="/api")

    # --- ✅ Auto-create tables only in development ---
    with app.app_context():
        db.create_all()

    # Optional health check route
    @app.route("/api/ping")
    def ping():
        return {"message": "pong"}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, threaded=False,port=5000,host="0.0.0.0")
