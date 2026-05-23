# Machine Learning Model Validation

Enterprise-grade ML validation patterns and best practices.

## Table of Contents

1. [Data Quality Checks](#data-quality-checks)
2. [Train/Test/Validation Splits](#traintestvaralidation-splits)
3. [Cross-Validation Strategies](#cross-validation-strategies)
4. [Performance Metrics](#performance-metrics)
5. [Bias Detection and Fairness](#bias-detection-and-fairness)
6. [Model Drift Monitoring](#model-drift-monitoring)
7. [A/B Testing for ML Models](#ab-testing-for-ml-models)
8. [Feature Importance Analysis](#feature-importance-analysis)
9. [Hyperparameter Tuning Validation](#hyperparameter-tuning-validation)
10. [MLOps Pipeline Validation](#mlops-pipeline-validation)

## Data Quality Checks

### Data Quality Framework

```python
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple

class DataQualityValidator:
    """Comprehensive data quality assessment"""

    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.report = {}

    def check_completeness(self) -> Dict:
        """Check for missing values"""
        completeness = {}

        for column in self.df.columns:
            null_count = self.df[column].isnull().sum()
            null_pct = (null_count / len(self.df)) * 100

            completeness[column] = {
                'null_count': int(null_count),
                'null_percentage': round(null_pct, 2),
                'status': 'OK' if null_pct < 5 else 'WARNING' if null_pct < 20 else 'CRITICAL'
            }

        return completeness

    def check_uniqueness(self) -> Dict:
        """Check for duplicates and uniqueness"""
        duplicates = {
            'total_duplicates': self.df.duplicated().sum(),
            'duplicate_percentage': round((self.df.duplicated().sum() / len(self.df)) * 100, 2),
            'duplicate_rows': self.df[self.df.duplicated(keep=False)].shape[0],
        }

        return duplicates

    def check_consistency(self) -> Dict:
        """Check data consistency and valid ranges"""
        consistency = {}

        for column in self.df.columns:
            if pd.api.types.is_numeric_dtype(self.df[column]):
                col_data = self.df[column].dropna()
                consistency[column] = {
                    'min': float(col_data.min()),
                    'max': float(col_data.max()),
                    'mean': float(col_data.mean()),
                    'std': float(col_data.std()),
                    'outliers': int((np.abs(col_data - col_data.mean()) > 3 * col_data.std()).sum())
                }

        return consistency

    def check_validity(self) -> Dict:
        """Check for invalid data types and format issues"""
        validity = {}

        for column in self.df.columns:
            dtype = str(self.df[column].dtype)
            validity[column] = {
                'dtype': dtype,
                'unique_values': self.df[column].nunique(),
                'unique_percentage': round((self.df[column].nunique() / len(self.df)) * 100, 2)
            }

        return validity

    def check_cardinality(self) -> Dict:
        """Check for high-cardinality columns that might need encoding"""
        cardinality = {}

        for column in self.df.select_dtypes(include=['object']).columns:
            unique_count = self.df[column].nunique()
            cardinality[column] = {
                'unique_values': unique_count,
                'cardinality_ratio': round(unique_count / len(self.df), 4),
                'requires_encoding': unique_count > 50,
            }

        return cardinality

    def generate_report(self) -> Dict:
        """Generate comprehensive data quality report"""
        self.report = {
            'dataset_shape': {'rows': len(self.df), 'columns': len(self.df.columns)},
            'completeness': self.check_completeness(),
            'uniqueness': self.check_uniqueness(),
            'consistency': self.check_consistency(),
            'validity': self.check_validity(),
            'cardinality': self.check_cardinality(),
        }

        # Overall quality score
        quality_score = self._calculate_quality_score()
        self.report['overall_quality_score'] = quality_score

        return self.report

    def _calculate_quality_score(self) -> float:
        """Calculate overall data quality score (0-100)"""
        score = 100.0

        # Deduct for completeness
        for col, info in self.report.get('completeness', {}).items():
            if info['status'] == 'CRITICAL':
                score -= 20
            elif info['status'] == 'WARNING':
                score -= 5

        # Deduct for duplicates
        if self.report.get('uniqueness', {}).get('duplicate_percentage', 0) > 5:
            score -= 10

        # Deduct for high cardinality
        high_cardinality = sum(
            1 for v in self.report.get('cardinality', {}).values()
            if v.get('requires_encoding', False)
        )
        score -= (high_cardinality * 2)

        return max(0, min(100, score))

# Usage
df = pd.read_csv('data.csv')
validator = DataQualityValidator(df)
report = validator.generate_report()

print(f"Overall Quality Score: {report['overall_quality_score']}/100")
print(f"Complete Columns: {sum(1 for c in report['completeness'].values() if c['status'] == 'OK')}")
print(f"Duplicate Rows: {report['uniqueness']['total_duplicates']}")
```

## Train/Test/Validation Splits

### Stratified Split Strategy

```python
from sklearn.model_selection import train_test_split, StratifiedShuffleSplit
import pandas as pd

class DataSplitter:
    """Proper train/test/validation splitting strategies"""

    @staticmethod
    def stratified_split(
        X: pd.DataFrame,
        y: pd.Series,
        test_size: float = 0.2,
        val_size: float = 0.1,
        random_state: int = 42
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, pd.Series]:
        """
        Split data into train/val/test with stratification.

        For classification: Ensures same class distribution across splits
        For regression: Bins continuous target into quartiles for stratification
        """

        # For regression, use quantile-based stratification
        if y.dtype != 'object':  # Regression target
            y_strata = pd.qcut(y, q=4, labels=False, duplicates='drop')
        else:
            y_strata = y

        # First split: Train + Val vs Test
        X_temp, X_test, y_temp, y_test = train_test_split(
            X, y,
            test_size=test_size,
            stratify=y_strata,
            random_state=random_state
        )

        # Second split: Train vs Val
        val_size_adjusted = val_size / (1 - test_size)
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp,
            test_size=val_size_adjusted,
            stratify=y_temp if y_temp.dtype == 'object' else pd.qcut(y_temp, q=4, labels=False, duplicates='drop'),
            random_state=random_state
        )

        print(f"Train size: {len(X_train)} ({len(X_train)/len(X)*100:.1f}%)")
        print(f"Val size: {len(X_val)} ({len(X_val)/len(X)*100:.1f}%)")
        print(f"Test size: {len(X_test)} ({len(X_test)/len(X)*100:.1f}%)")

        # Verify no data leakage
        assert len(set(X_train.index) & set(X_val.index)) == 0, "Data leakage between train/val"
        assert len(set(X_train.index) & set(X_test.index)) == 0, "Data leakage between train/test"
        assert len(set(X_val.index) & set(X_test.index)) == 0, "Data leakage between val/test"

        return X_train, X_val, X_test, y_train, y_val, y_test

    @staticmethod
    def time_series_split(
        X: pd.DataFrame,
        y: pd.Series,
        train_pct: float = 0.6,
        val_pct: float = 0.2
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, pd.Series]:
        """
        Time series specific split (preserves temporal order).
        No future data leakage.
        """
        n = len(X)
        train_end = int(n * train_pct)
        val_end = int(n * (train_pct + val_pct))

        X_train = X.iloc[:train_end]
        X_val = X.iloc[train_end:val_end]
        X_test = X.iloc[val_end:]

        y_train = y.iloc[:train_end]
        y_val = y.iloc[train_end:val_end]
        y_test = y.iloc[val_end:]

        print(f"Train size: {len(X_train)} (earliest to {X_train.index[-1]})")
        print(f"Val size: {len(X_val)} ({X_val.index[0]} to {X_val.index[-1]})")
        print(f"Test size: {len(X_test)} (latest from {X_test.index[0]})")

        return X_train, X_val, X_test, y_train, y_val, y_test

    @staticmethod
    def cross_validation_split(
        X: pd.DataFrame,
        y: pd.Series,
        n_splits: int = 5
    ) -> List[Tuple[np.ndarray, np.ndarray]]:
        """
        K-Fold cross-validation indices (don't use for final evaluation).
        """
        from sklearn.model_selection import StratifiedKFold

        skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        folds = []

        for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
            folds.append((train_idx, val_idx))
            print(f"Fold {fold}: Train {len(train_idx)}, Val {len(val_idx)}")

        return folds
```

## Cross-Validation Strategies

### K-Fold Cross-Validation

```python
from sklearn.model_selection import KFold, StratifiedKFold, TimeSeriesSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score
import numpy as np

class CrossValidationEvaluator:
    """Cross-validation for robust performance estimation"""

    @staticmethod
    def stratified_kfold_cv(
        model,
        X: np.ndarray,
        y: np.ndarray,
        n_splits: int = 5,
        metrics: List[str] = None
    ) -> Dict:
        """
        Stratified K-Fold for classification.
        More robust than train/test split alone.
        """
        if metrics is None:
            metrics = ['accuracy', 'precision', 'recall', 'f1']

        skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        fold_results = []

        for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]

            # Train model
            model.fit(X_train, y_train)

            # Evaluate
            y_pred = model.predict(X_val)

            fold_result = {
                'fold': fold,
                'train_size': len(train_idx),
                'val_size': len(val_idx),
                'metrics': {}
            }

            for metric in metrics:
                if metric == 'accuracy':
                    fold_result['metrics']['accuracy'] = accuracy_score(y_val, y_pred)
                elif metric == 'precision':
                    fold_result['metrics']['precision'] = precision_score(y_val, y_pred, average='weighted')
                elif metric == 'recall':
                    fold_result['metrics']['recall'] = recall_score(y_val, y_pred, average='weighted')

            fold_results.append(fold_result)

        # Aggregate results
        results = {
            'cv_strategy': f'{n_splits}-Fold Stratified',
            'folds': fold_results,
            'summary': {}
        }

        for metric in metrics:
            scores = [f['metrics'].get(metric, 0) for f in fold_results]
            results['summary'][metric] = {
                'mean': np.mean(scores),
                'std': np.std(scores),
                'min': np.min(scores),
                'max': np.max(scores),
                'scores': scores
            }

        return results

    @staticmethod
    def nested_cv(
        model,
        X: np.ndarray,
        y: np.ndarray,
        param_grid: Dict,
        outer_splits: int = 5,
        inner_splits: int = 3
    ) -> Dict:
        """
        Nested CV for hyperparameter tuning + evaluation.
        Prevents hyperparameter overfitting.

        Outer CV: For unbiased performance estimation
        Inner CV: For hyperparameter selection
        """
        from sklearn.model_selection import GridSearchCV

        outer_cv = StratifiedKFold(n_splits=outer_splits, shuffle=True, random_state=42)
        outer_scores = []

        for fold, (train_idx, val_idx) in enumerate(outer_cv.split(X, y)):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]

            # Inner CV for hyperparameter tuning
            inner_cv = StratifiedKFold(n_splits=inner_splits, shuffle=True, random_state=42)

            grid_search = GridSearchCV(
                model,
                param_grid,
                cv=inner_cv,
                scoring='accuracy',
                n_jobs=-1
            )

            grid_search.fit(X_train, y_train)

            # Evaluate on outer fold
            best_model = grid_search.best_estimator_
            outer_score = best_model.score(X_val, y_val)
            outer_scores.append(outer_score)

            print(f"Fold {fold}: Best params {grid_search.best_params_}, Score: {outer_score:.4f}")

        return {
            'cv_strategy': f'Nested CV ({outer_splits} outer, {inner_splits} inner)',
            'scores': outer_scores,
            'mean_score': np.mean(outer_scores),
            'std_score': np.std(outer_scores),
            'ci_95': [np.mean(outer_scores) - 1.96 * np.std(outer_scores) / np.sqrt(len(outer_scores)),
                      np.mean(outer_scores) + 1.96 * np.std(outer_scores) / np.sqrt(len(outer_scores))]
        }

    @staticmethod
    def time_series_cv(
        model,
        X: np.ndarray,
        y: np.ndarray,
        n_splits: int = 5
    ) -> Dict:
        """
        Walk-forward validation for time series.
        Avoids future data leakage.
        """
        tscv = TimeSeriesSplit(n_splits=n_splits)
        scores = []

        for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]

            model.fit(X_train, y_train)
            score = model.score(X_val, y_val)
            scores.append(score)

            print(f"Fold {fold}: Train [{0}-{train_idx[-1]}], Val [{val_idx[0]}-{val_idx[-1]}], Score: {score:.4f}")

        return {
            'cv_strategy': f'Time Series CV ({n_splits} splits)',
            'scores': scores,
            'mean_score': np.mean(scores),
            'std_score': np.std(scores),
        }
```

## Performance Metrics

### Multi-Class Classification Metrics

```python
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score, roc_curve,
    classification_report, log_loss
)
import numpy as np

class PerformanceMetrics:
    """Comprehensive metric calculation for classification"""

    @staticmethod
    def calculate_metrics(
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_pred_proba: np.ndarray = None,
        task: str = 'binary'  # 'binary' or 'multiclass'
    ) -> Dict:
        """
        Calculate comprehensive classification metrics.

        For Binary Classification:
        - Accuracy: (TP + TN) / (TP + TN + FP + FN) → Overall correctness
        - Precision: TP / (TP + FP) → Positive predictions that are correct
        - Recall: TP / (TP + FN) → Actual positives we found
        - F1 Score: 2 * (Precision * Recall) / (Precision + Recall) → Harmonic mean
        - AUC-ROC: Area under receiver operating characteristic curve → Classification threshold-independent

        For Multiclass:
        - Weighted: Weight by support (class frequency)
        - Macro: Unweighted mean across classes
        - Micro: Calculate globally by counting TP/FP/TN/FN
        """

        metrics = {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision': precision_score(y_true, y_pred, average='weighted' if task == 'multiclass' else 'binary', zero_division=0),
            'recall': recall_score(y_true, y_pred, average='weighted' if task == 'multiclass' else 'binary', zero_division=0),
            'f1': f1_score(y_true, y_pred, average='weighted' if task == 'multiclass' else 'binary', zero_division=0),
        }

        # Classification report with per-class metrics
        metrics['classification_report'] = classification_report(y_true, y_pred, output_dict=True)

        # Confusion matrix
        metrics['confusion_matrix'] = confusion_matrix(y_true, y_pred)

        # AUC-ROC (requires probability predictions)
        if y_pred_proba is not None:
            if task == 'binary':
                metrics['auc_roc'] = roc_auc_score(y_true, y_pred_proba[:, 1])
            else:
                try:
                    metrics['auc_roc'] = roc_auc_score(y_true, y_pred_proba, multi_class='ovr')
                except:
                    metrics['auc_roc'] = None

            # Log loss (lower is better, measures probability calibration)
            metrics['log_loss'] = log_loss(y_true, y_pred_proba)

        return metrics

    @staticmethod
    def calculate_regression_metrics(
        y_true: np.ndarray,
        y_pred: np.ndarray
    ) -> Dict:
        """Calculate regression metrics"""
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_true, y_pred)
        r2 = r2_score(y_true, y_pred)

        # MAPE (Mean Absolute Percentage Error)
        mape = np.mean(np.abs((y_true - y_pred) / y_true))

        return {
            'mse': mse,
            'rmse': rmse,
            'mae': mae,
            'mape': mape,
            'r2_score': r2,
        }

    @staticmethod
    def calculate_threshold_metrics(
        y_true: np.ndarray,
        y_pred_proba: np.ndarray,
        threshold: float = 0.5
    ) -> Dict:
        """
        Calculate metrics at specific probability threshold.
        Useful for tuning decision threshold.
        """
        y_pred = (y_pred_proba[:, 1] >= threshold).astype(int)

        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()

        return {
            'threshold': threshold,
            'true_positive_rate': tp / (tp + fn),  # Sensitivity/Recall
            'false_positive_rate': fp / (fp + tn),  # False alarm rate
            'true_negative_rate': tn / (tn + fp),  # Specificity
            'precision': tp / (tp + fp) if (tp + fp) > 0 else 0,
            'f1_score': 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) > 0 else 0,
            'confusion_matrix': {'tp': int(tp), 'fp': int(fp), 'tn': int(tn), 'fn': int(fn)}
        }
```

## Bias Detection and Fairness

### Fairness Metrics

```python
from sklearn.metrics import confusion_matrix
import numpy as np

class FairnessMetrics:
    """Detect and measure bias across demographic groups"""

    @staticmethod
    def demographic_parity(
        y_pred: np.ndarray,
        protected_attribute: np.ndarray
    ) -> Dict:
        """
        Demographic parity: Positive prediction rate should be equal across groups.
        Difference should be < 10% (often called "80% rule").
        """
        results = {}

        for group in np.unique(protected_attribute):
            mask = protected_attribute == group
            positive_rate = np.mean(y_pred[mask] == 1)
            results[f'group_{group}'] = positive_rate

        # Calculate disparity
        rates = list(results.values())
        max_rate = max(rates)
        min_rate = min(rates)
        disparity_ratio = min_rate / max_rate if max_rate > 0 else 1.0

        results['disparity_ratio'] = disparity_ratio
        results['passes_80_percent_rule'] = disparity_ratio >= 0.8

        return results

    @staticmethod
    def equalized_odds(
        y_true: np.ndarray,
        y_pred: np.ndarray,
        protected_attribute: np.ndarray
    ) -> Dict:
        """
        Equalized odds: True positive rate and false positive rate
        should be equal across demographic groups.
        """
        results = {}

        for group in np.unique(protected_attribute):
            mask = protected_attribute == group
            y_true_group = y_true[mask]
            y_pred_group = y_pred[mask]

            tn, fp, fn, tp = confusion_matrix(y_true_group, y_pred_group).ravel()

            tpr = tp / (tp + fn) if (tp + fn) > 0 else 0
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0

            results[f'group_{group}'] = {
                'true_positive_rate': tpr,
                'false_positive_rate': fpr,
            }

        return results

    @staticmethod
    def calibration_analysis(
        y_true: np.ndarray,
        y_pred_proba: np.ndarray,
        protected_attribute: np.ndarray,
        n_bins: int = 5
    ) -> Dict:
        """
        Calibration: Are predicted probabilities accurate within each group?
        Perfect calibration: predicted prob ≈ actual positive rate
        """
        results = {}

        for group in np.unique(protected_attribute):
            mask = protected_attribute == group
            y_true_group = y_true[mask]
            y_pred_proba_group = y_pred_proba[mask]

            # Bin predictions
            bins = np.linspace(0, 1, n_bins + 1)
            calibration_data = []

            for i in range(n_bins):
                bin_mask = (y_pred_proba_group >= bins[i]) & (y_pred_proba_group < bins[i + 1])
                if bin_mask.sum() > 0:
                    expected_prob = np.mean(y_pred_proba_group[bin_mask])
                    actual_prob = np.mean(y_true_group[bin_mask])
                    count = bin_mask.sum()

                    calibration_data.append({
                        'bin': i,
                        'expected_prob': expected_prob,
                        'actual_prob': actual_prob,
                        'calibration_error': abs(expected_prob - actual_prob),
                        'sample_count': count
                    })

            results[f'group_{group}'] = {
                'calibration_data': calibration_data,
                'mean_calibration_error': np.mean([d['calibration_error'] for d in calibration_data])
            }

        return results

    @staticmethod
    def disparate_impact_analysis(
        y_true: np.ndarray,
        y_pred: np.ndarray,
        protected_attribute: np.ndarray
    ) -> Dict:
        """
        Disparate impact (EEOC 4/5th rule):
        Selection rate for protected group should be ≥80% of non-protected group rate
        """
        results = {}

        groups = np.unique(protected_attribute)
        group_rates = {}

        for group in groups:
            mask = protected_attribute == group
            selection_rate = np.mean(y_pred[mask] == 1)
            group_rates[f'group_{group}'] = selection_rate

        # Calculate disparate impact
        rates = list(group_rates.values())
        max_rate = max(rates)
        min_rate = min(rates)
        di_ratio = min_rate / max_rate if max_rate > 0 else 1.0

        results.update(group_rates)
        results['disparate_impact_ratio'] = di_ratio
        results['passes_4_5_rule'] = di_ratio >= 0.8
        results['interpretation'] = (
            'No adverse impact detected' if di_ratio >= 0.8
            else 'Potential disparate impact detected - requires investigation'
        )

        return results
```

## Model Drift Monitoring

### Production Monitoring

```python
import numpy as np
from scipy import stats

class DriftDetector:
    """Monitor for model and data drift in production"""

    @staticmethod
    def detect_data_drift(
        reference_data: np.ndarray,
        current_data: np.ndarray,
        method: str = 'ks',
        threshold: float = 0.05
    ) -> Dict:
        """
        Detect data distribution shift.

        Methods:
        - KS (Kolmogorov-Smirnov): Detects overall distribution changes
        - Wasserstein: Measures distance between distributions
        - Population Stability Index (PSI): Compares binned distributions
        """
        if method == 'ks':
            statistic, p_value = stats.ks_2samp(reference_data, current_data)
            drift_detected = p_value < threshold

            return {
                'method': 'Kolmogorov-Smirnov',
                'statistic': statistic,
                'p_value': p_value,
                'threshold': threshold,
                'drift_detected': drift_detected,
                'interpretation': (
                    'Data distribution has significantly changed' if drift_detected
                    else 'No significant data drift detected'
                )
            }

        elif method == 'wasserstein':
            distance = stats.wasserstein_distance(reference_data, current_data)
            # Threshold depends on data scale; usually set empirically
            drift_detected = distance > threshold

            return {
                'method': 'Wasserstein Distance',
                'distance': distance,
                'threshold': threshold,
                'drift_detected': drift_detected,
            }

        elif method == 'psi':
            # Population Stability Index
            reference_pct = np.histogram(reference_data, bins=20)[0] / len(reference_data)
            current_pct = np.histogram(current_data, bins=20)[0] / len(current_data)

            psi = np.sum((current_pct - reference_pct) * np.log(current_pct / (reference_pct + 1e-10)))

            # PSI interpretation:
            # < 0.1: No significant population change
            # 0.1-0.25: Small population change
            # > 0.25: Large population change
            if psi < 0.1:
                severity = 'None'
            elif psi < 0.25:
                severity = 'Small'
            else:
                severity = 'Large'

            return {
                'method': 'Population Stability Index',
                'psi': psi,
                'severity': severity,
                'drift_detected': psi > 0.1,
            }

    @staticmethod
    def detect_prediction_drift(
        reference_predictions: np.ndarray,
        current_predictions: np.ndarray
    ) -> Dict:
        """Monitor model predictions for unexplained changes"""
        reference_mean = np.mean(reference_predictions)
        current_mean = np.mean(current_predictions)
        mean_shift = current_mean - reference_mean
        pct_change = (mean_shift / reference_mean) * 100

        # Statistical test
        statistic, p_value = stats.ttest_ind(reference_predictions, current_predictions)

        return {
            'reference_mean': reference_mean,
            'current_mean': current_mean,
            'mean_shift': mean_shift,
            'percent_change': pct_change,
            'p_value': p_value,
            'drift_detected': p_value < 0.05 and abs(pct_change) > 5,
            'interpretation': (
                f'Predictions have shifted by {pct_change:.1f}% - investigate causes'
                if p_value < 0.05 else 'No significant prediction drift'
            )
        }

    @staticmethod
    def detect_performance_degradation(
        reference_metrics: Dict,
        current_metrics: Dict,
        thresholds: Dict = None
    ) -> Dict:
        """Monitor model performance metrics over time"""
        if thresholds is None:
            # Default: 5% performance drop triggers alert
            thresholds = {
                'accuracy': 0.05,
                'precision': 0.05,
                'recall': 0.05,
                'f1': 0.05,
            }

        degradation = {}

        for metric, threshold in thresholds.items():
            if metric in reference_metrics and metric in current_metrics:
                ref_val = reference_metrics[metric]
                curr_val = current_metrics[metric]
                change = curr_val - ref_val
                pct_change = (change / ref_val) * 100 if ref_val > 0 else 0

                degradation[metric] = {
                    'reference': ref_val,
                    'current': curr_val,
                    'change': change,
                    'percent_change': pct_change,
                    'degraded': change < (-threshold),
                }

        return {
            'metrics': degradation,
            'overall_degraded': any(m['degraded'] for m in degradation.values()),
            'action_required': any(m['degraded'] for m in degradation.values())
        }
```

## A/B Testing for ML Models

### Statistical Testing

```python
from scipy import stats
import numpy as np

class ABTestingML:
    """A/B testing framework for model comparisons"""

    @staticmethod
    def compare_models_ttest(
        model_a_metrics: np.ndarray,
        model_b_metrics: np.ndarray,
        alpha: float = 0.05
    ) -> Dict:
        """
        Compare two models using t-test.
        H0: No difference between models
        """
        t_statistic, p_value = stats.ttest_ind(model_a_metrics, model_b_metrics)

        mean_diff = np.mean(model_b_metrics) - np.mean(model_a_metrics)

        return {
            'test': 't-test',
            'model_a_mean': np.mean(model_a_metrics),
            'model_b_mean': np.mean(model_b_metrics),
            'mean_difference': mean_diff,
            'p_value': p_value,
            'significant_at_alpha': p_value < alpha,
            'recommendation': (
                'Model B is statistically significantly better' if mean_diff > 0 and p_value < alpha else
                'Model A is statistically significantly better' if mean_diff < 0 and p_value < alpha else
                'No statistically significant difference'
            )
        }

    @staticmethod
    def compare_models_bootstrap(
        model_a_predictions: np.ndarray,
        model_b_predictions: np.ndarray,
        y_true: np.ndarray,
        n_bootstrap: int = 1000,
        alpha: float = 0.05
    ) -> Dict:
        """
        Bootstrap confidence intervals for model comparison.
        More robust than t-test.
        """
        from sklearn.metrics import accuracy_score

        bootstrap_diffs = []

        for _ in range(n_bootstrap):
            indices = np.random.choice(len(y_true), len(y_true), replace=True)

            a_score = accuracy_score(y_true[indices], model_a_predictions[indices])
            b_score = accuracy_score(y_true[indices], model_b_predictions[indices])

            bootstrap_diffs.append(b_score - a_score)

        bootstrap_diffs = np.array(bootstrap_diffs)

        # Confidence interval
        ci_lower = np.percentile(bootstrap_diffs, (alpha/2) * 100)
        ci_upper = np.percentile(bootstrap_diffs, (1 - alpha/2) * 100)

        # P-value: proportion of differences > 0
        p_value = np.mean(bootstrap_diffs > 0)

        return {
            'method': 'Bootstrap',
            'mean_difference': np.mean(bootstrap_diffs),
            'std_difference': np.std(bootstrap_diffs),
            'confidence_interval': [ci_lower, ci_upper],
            'p_value': p_value,
            'significant': ci_lower > 0 or ci_upper < 0,
            'recommendation': (
                'Model B is significantly better (CI does not include 0)' if ci_lower > 0 else
                'Model A is significantly better (CI does not include 0)' if ci_upper < 0 else
                'No significant difference (CI includes 0)'
            )
        }

    @staticmethod
    def sample_size_calculation(
        effect_size: float = 0.1,
        alpha: float = 0.05,
        power: float = 0.8
    ) -> int:
        """
        Calculate required sample size for A/B test.

        Effect size: Expected difference (e.g., 0.1 = 10% improvement)
        Power: Probability of detecting true effect (typically 0.8)
        Alpha: Type I error rate (false positive, typically 0.05)
        """
        from scipy.stats import norm

        # Calculate z-scores
        z_alpha = norm.ppf(1 - alpha/2)  # Two-tailed
        z_beta = norm.ppf(power)

        # Sample size per group
        n = 2 * ((z_alpha + z_beta) / effect_size) ** 2

        return int(np.ceil(n))

    @staticmethod
    def sequential_testing(
        successes_a: int,
        trials_a: int,
        successes_b: int,
        trials_b: int,
        stopping_threshold: float = 0.95
    ) -> Dict:
        """
        Sequential probability ratio test (SPRT).
        Allow early stopping when evidence is strong enough.
        """
        p_a = successes_a / trials_a if trials_a > 0 else 0
        p_b = successes_b / trials_b if trials_b > 0 else 0

        # Likelihood ratio
        if p_a > 0 and p_b > 0:
            lr = (p_b / p_a) ** successes_b * ((1 - p_b) / (1 - p_a)) ** (trials_b - successes_b)
        else:
            lr = 1.0

        confidence = min(lr / (lr + 1), 0.99) if lr >= 0 else 0

        return {
            'method': 'Sequential Probability Ratio Test',
            'model_a_rate': p_a,
            'model_b_rate': p_b,
            'likelihood_ratio': lr,
            'confidence': confidence,
            'can_stop': confidence > stopping_threshold,
            'recommendation': (
                'Can stop test - strong evidence for Model B' if confidence > stopping_threshold and p_b > p_a else
                'Can stop test - strong evidence for Model A' if confidence > stopping_threshold and p_a > p_b else
                'Continue testing - inconclusive'
            )
        }
```

---

**Remember**: ML validation is iterative. Monitor continuously, test statistically, and never deploy without comprehensive evaluation.
