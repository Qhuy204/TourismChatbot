"""
Shared system state for single-server deployment.
Replaces Redis system:state.
"""

# Possible states: RUNNING, MAINTENANCE, ERROR, DRAINING
_APP_STATE = "RUNNING"

def get_app_state() -> str:
    global _APP_STATE
    return _APP_STATE

def set_app_state(state: str) -> None:
    global _APP_STATE
    print(f"🔄 System state changed to: {state}")
    _APP_STATE = state
