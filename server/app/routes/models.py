"""
ML Model Metrics Route Handler
"""

from fastapi import APIRouter
from server.app.services.prediction_service import PredictionService

router = APIRouter(prefix="/models", tags=["Machine Learning"])

@router.get("/metrics")
def get_model_metrics():
    """
    Returns comparative evaluation metrics (Accuracy, Balanced Accuracy, Precision,
    Recall, Macro F1, Weighted F1), confusion matrices, and feature importances
    for Logistic Regression, Decision Tree, and Random Forest.
    """
    ps = PredictionService.get_instance()
    return ps.get_model_metrics()

