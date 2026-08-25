from django.urls import path
from .views import (
    CurrencyRatesView,
    NumberConverterView,
    CurrencyConverterView,
    UnitConverterView,
    DataStorageConverterView,
    ElectricalConverterView,
    HealthCalculatorView,
    SpecificCalculatorView,
    tools_history,
    delete_tools_history,
)

urlpatterns = [
    # NEW: Live rates endpoint (frontend yahi call karta hai)
    path('currency-rates/', CurrencyRatesView.as_view(), name='currency-rates'),
    
    path('number/', NumberConverterView.as_view(), name='number-converter'),
    path('currency/', CurrencyConverterView.as_view(), name='currency-converter'),
    path('unit/', UnitConverterView.as_view(), name='unit-converter'),
    path('data/', DataStorageConverterView.as_view(), name='data-converter'),
    path('electrical/', ElectricalConverterView.as_view(), name='electrical-converter'),
    path('health/', HealthCalculatorView.as_view(), name='health-calculator'),
    path('specific/', SpecificCalculatorView.as_view(), name='specific-calculator'),
    path('history/', tools_history, name='tools-history'),
    path('history/<int:pk>/delete/', delete_tools_history, name='delete-tools-history'),
]