import time
import traceback
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

import requests
from django.conf import settings
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ToolHistory, CurrencyRate, SavedCalculation
from .serializers import ToolHistorySerializer, SavedCalculationSerializer

# ✅ Yeh import sahi jagah par hai
from history.utils import save_to_history


# ═════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═════════════════════════════════════════════════════════════════

CACHE_TTL_SECONDS = 3600  # 1 hour
_rates_cache = {"payload": None, "timestamp": 0}

# Offline / fallback rates (1 unit = X INR)
FALLBACK_RATES_INR = {
    "INR": 1, "USD": 83.5, "EUR": 90.6, "GBP": 106.3, "JPY": 0.56,
    "AED": 22.74, "CAD": 61.2, "AUD": 55.4, "SGD": 62.3, "CHF": 93.8,
    "CNY": 11.6, "HKD": 10.72, "NZD": 50.1, "KRW": 0.061, "RUB": 0.95,
    "SEK": 7.95, "NOK": 7.85, "DKK": 12.13, "ZAR": 4.62, "BRL": 15.6,
    "MXN": 4.45, "MYR": 17.9, "THB": 2.36, "PHP": 1.46, "IDR": 0.0052,
    "SAR": 22.26, "TRY": 2.56, "PKR": 0.3, "BDT": 0.7, "LKR": 0.28,
    "NPR": 0.625, "PLN": 20.5, "HUF": 0.23, "QAR": 22.94,
}


# ═════════════════════════════════════════════════════════════════
# LIVE CURRENCY RATES
# ═════════════════════════════════════════════════════════════════

class CurrencyRatesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        now = time.time()

        if _rates_cache["payload"] and (now - _rates_cache["timestamp"]) < CACHE_TTL_SECONDS:
            return Response(_rates_cache["payload"])

        rates, source = self._fetch_live_rates()

        if not rates:
            rates = dict(FALLBACK_RATES_INR)
            source = "standard-rates (offline fallback)"

        payload = {
            "success": True,
            "base": "INR",
            "rates": rates,
            "source": source,
            "updated_at": timezone.now().strftime("%d %b %Y, %I:%M %p"),
            "cache_ttl_seconds": CACHE_TTL_SECONDS,
        }

        _rates_cache["payload"] = payload
        _rates_cache["timestamp"] = now

        self._sync_to_database(rates)

        return Response(payload)

    def _fetch_live_rates(self):
        fetchers = [
            (self._fetch_er_api, "open.er-api.com"),
            (self._fetch_frankfurter, "frankfurter.app"),
            (self._fetch_exchangerate_api, "exchangerate-api.com"),
        ]

        for fetcher, source in fetchers:
            try:
                rates = fetcher()
                if rates and rates.get("INR") == 1 and rates.get("USD"):
                    return rates, source
            except Exception:
                traceback.print_exc()
                continue

        return None, None

    def _fetch_er_api(self):
        resp = requests.get("https://open.er-api.com/v6/latest/USD", timeout=8)
        resp.raise_for_status()
        rates = (resp.json() or {}).get("rates") or {}
        inr_per_usd = rates.get("INR")
        if not inr_per_usd:
            return None

        result = {}
        for code in FALLBACK_RATES_INR:
            if code == "INR":
                result[code] = 1
                continue
            per_usd = rates.get(code)
            if per_usd:
                result[code] = round(inr_per_usd / per_usd, 6)
        return result

    def _fetch_frankfurter(self):
        resp = requests.get("https://api.frankfurter.app/latest?from=USD", timeout=8)
        resp.raise_for_status()
        rates = (resp.json() or {}).get("rates") or {}
        inr_per_usd = rates.get("INR")
        if not inr_per_usd:
            return None

        result = {}
        for code in FALLBACK_RATES_INR:
            if code == "INR":
                result[code] = 1
                continue
            per_usd = rates.get(code)
            if per_usd:
                result[code] = round(inr_per_usd / per_usd, 6)
        return result

    def _fetch_exchangerate_api(self):
        resp = requests.get("https://api.exchangerate-api.com/v4/latest/USD", timeout=8)
        resp.raise_for_status()
        rates = (resp.json() or {}).get("rates") or {}
        inr_per_usd = rates.get("INR")
        if not inr_per_usd:
            return None

        result = {}
        for code in FALLBACK_RATES_INR:
            if code == "INR":
                result[code] = 1
                continue
            per_usd = rates.get(code)
            if per_usd:
                result[code] = round(inr_per_usd / per_usd, 6)
        return result

    def _sync_to_database(self, rates):
        inr_rate = rates.get("INR", 1)
        for code, rate_in_inr in rates.items():
            if code == "INR":
                continue
            try:
                CurrencyRate.objects.update_or_create(
                    base_currency="INR",
                    target_currency=code,
                    defaults={
                        "rate": Decimal(str(rate_in_inr)),
                        "updated_at": timezone.now(),
                    },
                )
            except Exception:
                pass


# ═════════════════════════════════════════════════════════════════
# NUMBER CONVERTER
# ═════════════════════════════════════════════════════════════════

class NumberConverterView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        print("🚀 DEBUG: Number Converter API called!")
        value = request.data.get('value')
        from_base = request.data.get('from_base')
        to_base = request.data.get('to_base')

        if value is None or not from_base or not to_base:
            return Response({'success': False, 'message': 'value, from_base, and to_base are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decimal_val = self._to_decimal(value, from_base)
            result = self._from_decimal(decimal_val, to_base)

            history = ToolHistory.objects.create(
                user=request.user,
                tool_type='number_converter',
                input_data={'value': value, 'from_base': from_base, 'to_base': to_base},
                output_data={'result': result, 'decimal': decimal_val}
            )

            try:
                save_to_history(
                    user=request.user,
                    history_type="tools",
                    title="Number Converter",
                    description=f"Converted {value} from {from_base} to {to_base}",
                    source_app="tools",
                    source_model="ToolHistory",
                    source_id=str(history.id),
                    metadata={"toolType": "Number Converter", "fromUnit": from_base, "toUnit": to_base, "result": result},
                    status="completed"
                )
                print("✅ DEBUG: History successfully saved to UnifiedHistory!")
            except Exception as e:
                print("❌ Unified History save error:", e)

            return Response({
                'success': True,
                'data': {
                    'input': value, 
                    'from_base': from_base, 
                    'to_base': to_base,
                    'result': result, 
                    'decimal_equivalent': decimal_val,
                    'history_id': str(history.id),
                    'operation_id': str(history.id)  # ✅ Frontend local update ke liye zaroori
                }
            })
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def _to_decimal(self, value, base):
        value = str(value).strip().upper()
        if value.startswith("0X"): value = value[2:]
        elif value.startswith("0B"): value = value[2:]
        elif value.startswith("0O"): value = value[2:]

        if base == 'decimal': return int(value)
        elif base == 'binary': return int(value, 2)
        elif base in ('hex', 'hexadecimal'): return int(value, 16)
        elif base == 'octal': return int(value, 8)
        elif base == 'roman': return self._roman_to_int(value)
        else: raise ValueError(f"Unsupported base: {base}")

    def _from_decimal(self, num, base):
        if base == 'decimal': return str(num)
        elif base == 'binary': return bin(num)[2:]
        elif base in ('hex', 'hexadecimal'): return hex(num)[2:].upper()
        elif base == 'octal': return oct(num)[2:]
        elif base == 'roman': return self._int_to_roman(num)
        else: raise ValueError(f"Unsupported base: {base}")

    @staticmethod
    def _roman_to_int(s):
        roman_map = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
        total, prev = 0, 0
        for ch in reversed(s):
            curr = roman_map.get(ch, 0)
            total -= curr if curr < prev else curr
            prev = curr
        return total

    @staticmethod
    def _int_to_roman(num):
        val = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
        syb = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
        roman, i = '', 0
        while num > 0:
            for _ in range(num // val[i]):
                roman += syb[i]
                num -= val[i]
            i += 1
        return roman


# ═════════════════════════════════════════════════════════════════
# CURRENCY CONVERTER
# ═════════════════════════════════════════════════════════════════

class CurrencyConverterView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    SUPPORTED_CURRENCIES = list(FALLBACK_RATES_INR.keys())

    def post(self, request):
        amount = request.data.get('amount')
        from_currency = str(request.data.get('from_currency', 'USD')).upper()
        to_currency = str(request.data.get('to_currency', 'EUR')).upper()

        if amount is None:
            return Response({'success': False, 'message': 'amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount))
        except Exception:
            return Response({'success': False, 'message': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        rate = self._get_rate(from_currency, to_currency)
        if rate is None:
            return Response({'success': False, 'message': f'Exchange rate not available for {from_currency} to {to_currency}.'}, status=status.HTTP_400_BAD_REQUEST)

        result = (amount * Decimal(str(rate))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        history = ToolHistory.objects.create(
            user=request.user,
            tool_type='currency_converter',
            input_data={'amount': str(amount), 'from_currency': from_currency, 'to_currency': to_currency},
            output_data={'rate': float(rate), 'result': str(result)}
        )

        try:
            save_to_history(
                user=request.user,
                history_type="tools",
                title="Currency Converter",
                description=f"Converted {amount} {from_currency} to {to_currency}",
                source_app="tools",
                source_model="ToolHistory",
                source_id=str(history.id),
                metadata={"toolType": "Currency Converter", "fromUnit": from_currency, "toUnit": to_currency, "amount": str(amount), "result": str(result)},
                status="completed"
            )
        except Exception as e:
            print("❌ Unified History save error:", e)

        return Response({
            'success': True,
            'data': {
                'amount': str(amount), 'from_currency': from_currency, 'to_currency': to_currency,
                'rate': float(rate), 'result': str(result), 
                'history_id': str(history.id),
                'operation_id': str(history.id)  # ✅ ADDED
            }
        })

    def _get_rate(self, base, target):
        if base == target: return 1.0
        try:
            cached = CurrencyRate.objects.get(base_currency=base, target_currency=target)
            if (timezone.now() - cached.updated_at).total_seconds() < CACHE_TTL_SECONDS:
                return float(cached.rate)
        except (CurrencyRate.DoesNotExist, AttributeError):
            pass

        if base in FALLBACK_RATES_INR and target in FALLBACK_RATES_INR:
            return FALLBACK_RATES_INR[base] / FALLBACK_RATES_INR[target]

        try:
            url = f"https://api.exchangerate-api.com/v4/latest/{base}"
            resp = requests.get(url, timeout=10)
            data = resp.json()
            rate = data.get('rates', {}).get(target)
            if rate:
                CurrencyRate.objects.update_or_create(
                    base_currency=base, target_currency=target,
                    defaults={'rate': Decimal(str(rate)), 'updated_at': timezone.now()}
                )
                return rate
        except Exception:
            pass
        return None


# ═════════════════════════════════════════════════════════════════
# UNIT CONVERTER
# ═════════════════════════════════════════════════════════════════

class UnitConverterView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    UNITS = {
        'length': {'meter': 1, 'kilometer': 1000, 'centimeter': 0.01, 'millimeter': 0.001, 'mile': 1609.34, 'yard': 0.9144, 'foot': 0.3048, 'inch': 0.0254, 'nautical_mile': 1852},
        'weight': {'kilogram': 1, 'gram': 0.001, 'milligram': 0.000001, 'pound': 0.453592, 'ounce': 0.0283495, 'ton': 1000, 'stone': 6.35029},
        'area': {'square_meter': 1, 'square_kilometer': 1000000, 'square_centimeter': 0.0001, 'hectare': 10000, 'acre': 4046.86, 'square_mile': 2589988.11, 'square_yard': 0.836127, 'square_foot': 0.092903},
        'volume': {'liter': 1, 'milliliter': 0.001, 'cubic_meter': 1000, 'gallon_us': 3.78541, 'gallon_uk': 4.54609, 'quart': 0.946353, 'pint': 0.473176, 'cup': 0.24, 'fluid_ounce': 0.0295735},
        'speed': {'meter_per_second': 1, 'kilometer_per_hour': 0.277778, 'mile_per_hour': 0.44704, 'knot': 0.514444, 'foot_per_second': 0.3048}
    }

    def post(self, request):
        category = request.data.get('category')
        value = request.data.get('value')
        from_unit = request.data.get('from_unit')
        to_unit = request.data.get('to_unit')

        if not all([category, value is not None, from_unit, to_unit]):
            return Response({'success': False, 'message': 'category, value, from_unit, and to_unit are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            value = float(value)
        except Exception:
            return Response({'success': False, 'message': 'Invalid value.'}, status=status.HTTP_400_BAD_REQUEST)

        if category == 'temperature':
            result = self._convert_temperature(value, from_unit, to_unit)
        else:
            result = self._convert_standard(category, value, from_unit, to_unit)

        history = ToolHistory.objects.create(
            user=request.user,
            tool_type='unit_converter',
            input_data={'category': category, 'value': value, 'from_unit': from_unit, 'to_unit': to_unit},
            output_data={'result': result}
        )

        try:
            save_to_history(
                user=request.user,
                history_type="tools",
                title="Unit Converter",
                description=f"Converted {value} {from_unit} to {to_unit} ({category})",
                source_app="tools",
                source_model="ToolHistory",
                source_id=str(history.id),
                metadata={"toolType": "Unit Converter", "category": category, "fromUnit": from_unit, "toUnit": to_unit, "value": value, "result": result},
                status="completed"
            )
        except Exception as e:
            print("❌ Unified History save error:", e)

        return Response({
            'success': True,
            'data': {
                'category': category, 'value': value, 'from_unit': from_unit, 'to_unit': to_unit, 
                'result': result, 
                'history_id': str(history.id),
                'operation_id': str(history.id)  # ✅ ADDED
            }
        })

    def _convert_standard(self, category, value, from_unit, to_unit):
        units = self.UNITS.get(category)
        if not units: raise ValueError(f"Unsupported category: {category}")
        if from_unit not in units or to_unit not in units: raise ValueError("Invalid unit for this category.")
        return round((value * units[from_unit]) / units[to_unit], 6)

    def _convert_temperature(self, value, from_unit, to_unit):
        if from_unit == 'celsius': celsius = value
        elif from_unit == 'fahrenheit': celsius = (value - 32) * 5 / 9
        elif from_unit == 'kelvin': celsius = value - 273.15
        else: raise ValueError("Invalid temperature unit.")

        if to_unit == 'celsius': return round(celsius, 2)
        elif to_unit == 'fahrenheit': return round((celsius * 9 / 5) + 32, 2)
        elif to_unit == 'kelvin': return round(celsius + 273.15, 2)
        else: raise ValueError("Invalid temperature unit.")


# ═════════════════════════════════════════════════════════════════
# DATA STORAGE CONVERTER
# ═════════════════════════════════════════════════════════════════

class DataStorageConverterView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    UNITS = {
        'bit': 0.125, 'byte': 1, 'kilobyte': 1024, 'megabyte': 1024 ** 2,
        'gigabyte': 1024 ** 3, 'terabyte': 1024 ** 4, 'petabyte': 1024 ** 5,
        'kibibyte': 1024, 'mebibyte': 1024 ** 2, 'gibibyte': 1024 ** 3, 'tebibyte': 1024 ** 4,
    }

    def post(self, request):
        value = request.data.get('value')
        from_unit = request.data.get('from_unit')
        to_unit = request.data.get('to_unit')

        if value is None or not from_unit or not to_unit:
            return Response({'success': False, 'message': 'value, from_unit, and to_unit are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            value = float(value)
        except Exception:
            return Response({'success': False, 'message': 'Invalid value.'}, status=status.HTTP_400_BAD_REQUEST)

        if from_unit not in self.UNITS or to_unit not in self.UNITS:
            return Response({'success': False, 'message': 'Invalid unit.'}, status=status.HTTP_400_BAD_REQUEST)

        bytes_val = value * self.UNITS[from_unit]
        result = bytes_val / self.UNITS[to_unit]
        result = round(result, 4) if result >= 1 else round(result, 10)

        history = ToolHistory.objects.create(
            user=request.user,
            tool_type='data_storage_converter',
            input_data={'value': value, 'from_unit': from_unit, 'to_unit': to_unit},
            output_data={'result': result, 'bytes': bytes_val}
        )

        try:
            save_to_history(
                user=request.user,
                history_type="tools",
                title="Data Converter",
                description=f"Converted {value} {from_unit} to {to_unit}",
                source_app="tools",
                source_model="ToolHistory",
                source_id=str(history.id),
                metadata={"toolType": "Data Converter", "fromUnit": from_unit, "toUnit": to_unit, "value": value, "result": result},
                status="completed"
            )
        except Exception as e:
            print("❌ Unified History save error:", e)

        return Response({
            'success': True,
            'data': {
                'value': value, 'from_unit': from_unit, 'to_unit': to_unit, 'result': result, 
                'bytes_equivalent': bytes_val, 
                'history_id': str(history.id),
                'operation_id': str(history.id)  # ✅ ADDED
            }
        })


# ═════════════════════════════════════════════════════════════════
# ELECTRICAL UNITS CONVERTER
# ═════════════════════════════════════════════════════════════════

class ElectricalConverterView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        operation = request.data.get('operation')
        if operation == 'ohms_law': return self._ohms_law(request)
        elif operation == 'power': return self._power_calc(request)
        elif operation == 'resistance': return self._resistance_calc(request)
        else: return Response({'success': False, 'message': "operation must be 'ohms_law', 'power', or 'resistance'."}, status=status.HTTP_400_BAD_REQUEST)

    def _ohms_law(self, request):
        voltage, current, resistance = request.data.get('voltage'), request.data.get('current'), request.data.get('resistance')
        known = sum(x is not None for x in [voltage, current, resistance])
        if known != 2: return Response({'success': False, 'message': 'Provide exactly 2 of: voltage, current, resistance.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if voltage is None:
                current, resistance = float(current), float(resistance)
                result = {'voltage': round(current * resistance, 4), 'current': current, 'resistance': resistance}
            elif current is None:
                voltage, resistance = float(voltage), float(resistance)
                result = {'voltage': voltage, 'current': round(voltage / resistance, 4), 'resistance': resistance}
            else:
                voltage, current = float(voltage), float(current)
                result = {'voltage': voltage, 'current': current, 'resistance': round(voltage / current, 4)}
        except ZeroDivisionError:
            return Response({'success': False, 'message': 'Cannot divide by zero.'}, status=status.HTTP_400_BAD_REQUEST)

        history = ToolHistory.objects.create(user=request.user, tool_type='electrical_converter', input_data=request.data, output_data=result)
        self._save_unified_history(request.user, history, "Electrical Calculator", "ohms_law", result)
        return Response({'success': True, 'data': {**result, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _power_calc(self, request):
        power, voltage, current = request.data.get('power'), request.data.get('voltage'), request.data.get('current')
        try:
            if power is None and voltage and current:
                result = {'power': round(float(voltage) * float(current), 4), 'voltage': float(voltage), 'current': float(current)}
            elif voltage is None and power and current:
                result = {'power': float(power), 'voltage': round(float(power) / float(current), 4), 'current': float(current)}
            elif current is None and power and voltage:
                result = {'power': float(power), 'voltage': float(voltage), 'current': round(float(power) / float(voltage), 4)}
            else: return Response({'success': False, 'message': 'Provide exactly 2 of: power, voltage, current.'}, status=status.HTTP_400_BAD_REQUEST)
        except ZeroDivisionError:
            return Response({'success': False, 'message': 'Cannot divide by zero.'}, status=status.HTTP_400_BAD_REQUEST)

        history = ToolHistory.objects.create(user=request.user, tool_type='electrical_converter', input_data=request.data, output_data=result)
        self._save_unified_history(request.user, history, "Electrical Calculator", "power", result)
        return Response({'success': True, 'data': {**result, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _resistance_calc(self, request):
        resistances, connection = request.data.get('resistances', []), request.data.get('connection', 'series')
        if not resistances or not isinstance(resistances, list):
            return Response({'success': False, 'message': 'resistances must be a list of values.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resistances = [float(r) for r in resistances]
            total = sum(resistances) if connection == 'series' else 1 / sum(1 / r for r in resistances)
            result = {'total_resistance': round(total, 4), 'connection': connection, 'resistances': resistances}
        except ZeroDivisionError:
            return Response({'success': False, 'message': 'Resistances cannot be zero in parallel.'}, status=status.HTTP_400_BAD_REQUEST)

        history = ToolHistory.objects.create(user=request.user, tool_type='electrical_converter', input_data=request.data, output_data=result)
        self._save_unified_history(request.user, history, "Electrical Calculator", "resistance", result)
        return Response({'success': True, 'data': {**result, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _save_unified_history(self, user, history, title, operation, result):
        try:
            save_to_history(
                user=user, history_type="tools", title=title,
                description=f"Calculated {operation}",
                source_app="tools", source_model="ToolHistory", source_id=str(history.id),
                metadata={"toolType": "Electrical Calculator", "operation": operation, "result": result}, status="completed"
            )
        except Exception as e:
            print("❌ Unified History save error:", e)


# ═════════════════════════════════════════════════════════════════
# HEALTH CALCULATOR
# ═════════════════════════════════════════════════════════════════

class HealthCalculatorView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        calculator = request.data.get('calculator')
        if calculator == 'bmi': return self._bmi(request)
        elif calculator == 'bmr': return self._bmr(request)
        elif calculator == 'body_fat': return self._body_fat(request)
        elif calculator == 'calories': return self._calories(request)
        else: return Response({'success': False, 'message': "calculator must be 'bmi', 'bmr', 'body_fat', or 'calories'."}, status=status.HTTP_400_BAD_REQUEST)

    def _bmi(self, request):
        weight_kg, height_cm = request.data.get('weight_kg'), request.data.get('height_cm')
        if not weight_kg or not height_cm: return Response({'success': False, 'message': 'weight_kg and height_cm are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        height_m = float(height_cm) / 100
        bmi = float(weight_kg) / (height_m ** 2)
        category = 'Underweight' if bmi < 18.5 else 'Normal weight' if bmi < 25 else 'Overweight' if bmi < 30 else 'Obese'
        result = {'bmi': round(bmi, 2), 'category': category, 'weight_kg': float(weight_kg), 'height_cm': float(height_cm)}
        
        history = ToolHistory.objects.create(user=request.user, tool_type='health_calculator', input_data=request.data, output_data=result)
        self._save_unified_history(request.user, history, "Health Calculator", "BMI", result)
        return Response({'success': True, 'data': {**result, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _bmr(self, request):
        weight_kg, height_cm, age, gender = request.data.get('weight_kg'), request.data.get('height_cm'), request.data.get('age'), request.data.get('gender')
        if not all([weight_kg, height_cm, age, gender]): return Response({'success': False, 'message': 'weight_kg, height_cm, age, and gender are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        weight, height, age = float(weight_kg), float(height_cm), int(age)
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5 if gender.lower() == 'male' else (10 * weight) + (6.25 * height) - (5 * age) - 161
        result = {'bmr': round(bmr, 2), 'gender': gender, 'weight_kg': weight, 'height_cm': height, 'age': age}
        
        history = ToolHistory.objects.create(user=request.user, tool_type='health_calculator', input_data=request.data, output_data=result)
        self._save_unified_history(request.user, history, "Health Calculator", "BMR", result)
        return Response({'success': True, 'data': {**result, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _body_fat(self, request):
        waist_cm, neck_cm, height_cm, gender, hip_cm = request.data.get('waist_cm'), request.data.get('neck_cm'), request.data.get('height_cm'), request.data.get('gender'), request.data.get('hip_cm')
        if not all([waist_cm, neck_cm, height_cm, gender]): return Response({'success': False, 'message': 'waist_cm, neck_cm, height_cm, and gender are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if gender.lower() == 'female' and not hip_cm: return Response({'success': False, 'message': 'hip_cm is required for females.'}, status=status.HTTP_400_BAD_REQUEST)
        
        waist, neck, height = float(waist_cm), float(neck_cm), float(height_cm)
        if gender.lower() == 'male':
            body_fat = 495 / (1.0324 - 0.19077 * (waist - neck) / height + 0.15456 * height) - 450
        else:
            body_fat = 495 / (1.29579 - 0.35004 * (waist + float(hip_cm) - neck) / height + 0.22100 * height) - 450
            
        result = {'body_fat_percentage': round(abs(body_fat), 2), 'gender': gender, 'waist_cm': waist, 'neck_cm': neck, 'height_cm': height}
        
        history = ToolHistory.objects.create(user=request.user, tool_type='health_calculator', input_data=request.data, output_data=result)
        self._save_unified_history(request.user, history, "Health Calculator", "Body Fat", result)
        return Response({'success': True, 'data': {**result, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _calories(self, request):
        bmr, activity_level = request.data.get('bmr'), request.data.get('activity_level')
        if not bmr or not activity_level: return Response({'success': False, 'message': 'bmr and activity_level are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        multipliers = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'very_active': 1.9}
        multiplier = multipliers.get(activity_level.lower(), 1.2)
        tdee = float(bmr) * multiplier
        result = {'tdee': round(tdee, 2), 'bmr': float(bmr), 'activity_level': activity_level, 'multiplier': multiplier}
        
        history = ToolHistory.objects.create(user=request.user, tool_type='health_calculator', input_data=request.data, output_data=result)
        self._save_unified_history(request.user, history, "Health Calculator", "Calories", result)
        return Response({'success': True, 'data': {**result, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _save_unified_history(self, user, history, title, calculator, result):
        try:
            save_to_history(
                user=user, history_type="tools", title=title,
                description=f"Calculated {calculator}",
                source_app="tools", source_model="ToolHistory", source_id=str(history.id),
                metadata={"toolType": "Health Calculator", "calculator": calculator, "result": result}, status="completed"
            )
        except Exception as e:
            print("❌ Unified History save error:", e)


# ═════════════════════════════════════════════════════════════════
# SPECIFIC CALCULATOR
# ═════════════════════════════════════════════════════════════════

class SpecificCalculatorView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        calculator = request.data.get('calculator')
        if calculator == 'percentage': return self._percentage(request)
        elif calculator == 'loan': return self._loan(request)
        elif calculator == 'tip': return self._tip(request)
        elif calculator == 'age': return self._age(request)
        elif calculator == 'gpa': return self._gpa(request)
        else: return Response({'success': False, 'message': "calculator must be 'percentage', 'loan', 'tip', 'age', or 'gpa'."}, status=status.HTTP_400_BAD_REQUEST)

    def _percentage(self, request):
        operation, value1, value2 = request.data.get('operation'), request.data.get('value1'), request.data.get('value2')
        if value1 is None or value2 is None: return Response({'success': False, 'message': 'value1 and value2 are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        v1, v2 = float(value1), float(value2)
        if operation == 'find_percentage': output = {'percentage': round((v1 / v2) * 100, 4), 'value': v1, 'total': v2}
        elif operation == 'find_value': output = {'value': round((v1 / 100) * v2, 4), 'percentage': v1, 'total': v2}
        elif operation == 'find_total': output = {'total': round((v1 / v2) * 100, 4), 'value': v1, 'percentage': v2}
        else: return Response({'success': False, 'message': "operation must be 'find_percentage', 'find_value', or 'find_total'."}, status=status.HTTP_400_BAD_REQUEST)
        
        history = ToolHistory.objects.create(user=request.user, tool_type='specific_calculator', input_data=request.data, output_data=output)
        self._save_unified_history(request.user, history, "Specific Calculator", "Percentage", output)
        return Response({'success': True, 'data': {**output, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _loan(self, request):
        principal, annual_rate, years = request.data.get('principal'), request.data.get('annual_rate'), request.data.get('years')
        if not all([principal, annual_rate, years]): return Response({'success': False, 'message': 'principal, annual_rate, and years are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        P, r, n = float(principal), float(annual_rate) / 100 / 12, int(years) * 12
        monthly_payment = P / n if r == 0 else P * (r * (1 + r) ** n) / ((1 + r) ** n - 1)
        output = {'monthly_payment': round(monthly_payment, 2), 'total_payment': round(monthly_payment * n, 2), 'total_interest': round((monthly_payment * n) - P, 2), 'principal': P, 'annual_rate': float(annual_rate), 'years': int(years)}
        
        history = ToolHistory.objects.create(user=request.user, tool_type='specific_calculator', input_data=request.data, output_data=output)
        self._save_unified_history(request.user, history, "Specific Calculator", "Loan", output)
        return Response({'success': True, 'data': {**output, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _tip(self, request):
        bill_amount, tip_percentage, split_between = request.data.get('bill_amount'), request.data.get('tip_percentage', 15), request.data.get('split_between', 1)
        if not bill_amount: return Response({'success': False, 'message': 'bill_amount is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        bill, tip = float(bill_amount), float(bill_amount) * (float(tip_percentage) / 100)
        total = bill + tip
        output = {'bill_amount': round(bill, 2), 'tip_amount': round(tip, 2), 'total_amount': round(total, 2), 'tip_percentage': float(tip_percentage), 'split_between': int(split_between), 'per_person': round(total / int(split_between), 2)}
        
        history = ToolHistory.objects.create(user=request.user, tool_type='specific_calculator', input_data=request.data, output_data=output)
        self._save_unified_history(request.user, history, "Specific Calculator", "Tip", output)
        return Response({'success': True, 'data': {**output, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _age(self, request):
        birth_date = request.data.get('birth_date')
        if not birth_date: return Response({'success': False, 'message': 'birth_date is required (YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            birth = datetime.strptime(birth_date, '%Y-%m-%d')
            today = datetime.now()
            years = today.year - birth.year
            if (today.month, today.day) < (birth.month, birth.day): years -= 1
            
            next_birthday = birth.replace(year=today.year)
            if next_birthday < today: next_birthday = next_birthday.replace(year=today.year + 1)
            
            output = {'years': years, 'birth_date': birth_date, 'days_until_next_birthday': (next_birthday - today).days, 'next_birthday': next_birthday.strftime('%Y-%m-%d')}
        except ValueError:
            return Response({'success': False, 'message': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
            
        history = ToolHistory.objects.create(user=request.user, tool_type='specific_calculator', input_data=request.data, output_data=output)
        self._save_unified_history(request.user, history, "Specific Calculator", "Age", output)
        return Response({'success': True, 'data': {**output, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _gpa(self, request):
        grades = request.data.get('grades', [])
        if not grades: return Response({'success': False, 'message': 'grades array is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        grade_points = {'A+': 4.0, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'D-': 0.7, 'F': 0.0}
        total_points, total_credits = 0, 0
        
        for g in grades:
            credits = float(g.get('credits', 0))
            points = grade_points.get(g.get('grade', '').upper(), 0)
            total_points += points * credits
            total_credits += credits
            
        output = {'gpa': round(total_points / total_credits, 2) if total_credits > 0 else 0, 'total_credits': total_credits, 'grades_count': len(grades)}
        
        history = ToolHistory.objects.create(user=request.user, tool_type='specific_calculator', input_data=request.data, output_data=output)
        self._save_unified_history(request.user, history, "Specific Calculator", "GPA", output)
        return Response({'success': True, 'data': {**output, 'history_id': str(history.id), 'operation_id': str(history.id)}}) # ✅ ADDED

    def _save_unified_history(self, user, history, title, calculator, output):
        try:
            save_to_history(
                user=user, history_type="tools", title=title,
                description=f"Calculated {calculator}",
                source_app="tools", source_model="ToolHistory", source_id=str(history.id),
                metadata={"toolType": "Specific Calculator", "calculator": calculator, "result": output}, status="completed"
            )
        except Exception as e:
            print("❌ Unified History save error:", e)


# ═════════════════════════════════════════════════════════════════
# TOOLS HISTORY
# ═════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def tools_history(request):
    tool_type = request.query_params.get('tool_type')
    queryset = ToolHistory.objects.filter(user=request.user)

    if tool_type:
        queryset = queryset.filter(tool_type=tool_type)

    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))
    start = (page - 1) * page_size
    end = start + page_size

    total = queryset.count()
    serializer = ToolHistorySerializer(queryset[start:end], many=True)

    return Response({
        'success': True,
        'total': total,
        'page': page,
        'page_size': page_size,
        'data': serializer.data
    })


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_tools_history(request, pk):
    try:
        history = ToolHistory.objects.get(pk=pk, user=request.user)
        history.delete()
        return Response({'success': True, 'message': 'Deleted successfully.'})
    except ToolHistory.DoesNotExist:
        return Response({'success': False, 'message': 'History item not found.'}, status=status.HTTP_404_NOT_FOUND)