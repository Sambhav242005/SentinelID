from flask import Flask
from config import config
from models import db
from routes import main_blueprint


def create_app():
    app = Flask(__name__)
    app.config.from_object(config)
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(main_blueprint, url_prefix="/api")

    # Create tables (only in development)
    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    app = create_app()

    app.run(host="0.0.0.0", port=5000, debug=True)
