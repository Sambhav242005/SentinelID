from flask import Blueprint

# Import submodules after creating blueprint
from .auth_routes import auth_bp
from .alias_routes import alias_bp
from .breach_routes import breach_bp
from .password_routes import password_bp
from .session_routes import session_bp
from .ai_routes import ai_bp
from .incident_routes import incident_bp
from .isolated_routes import isolated_bp
# Create the main blueprint
main_blueprint = Blueprint("main", __name__)



# ✅ Register all child blueprints under main
# Each child keeps its own prefix internally (optional)
main_blueprint.register_blueprint(auth_bp, url_prefix="/auth")
main_blueprint.register_blueprint(alias_bp)
main_blueprint.register_blueprint(breach_bp, url_prefix="/breach")
main_blueprint.register_blueprint(password_bp, url_prefix="/password")
main_blueprint.register_blueprint(ai_bp, url_prefix="/ai")
main_blueprint.register_blueprint(incident_bp, url_prefix="/incidents")
main_blueprint.register_blueprint(isolated_bp, url_prefix="/isolated")
main_blueprint.register_blueprint(session_bp)


__all__ = ["main_blueprint"]
