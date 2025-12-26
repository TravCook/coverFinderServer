from sklearn.model_selection import BaseCrossValidator
import numpy as np


class RollingTimeSeriesSplit(BaseCrossValidator):
    """
    Rolling time series cross-validator with optional purge gap.
    The last fold always includes the last sample.
    """
    def __init__(self, n_splits=5, train_size=0.6, test_size=0.1, purge_gap=0):
        self.n_splits = n_splits
        self.train_size = train_size
        self.test_size = test_size
        self.purge_gap = purge_gap

    def get_n_splits(self, X=None, y=None, groups=None):
        return self.n_splits

    def split(self, X, y=None, groups=None):
        n_samples = len(X)
        train_len = int(n_samples * self.train_size)
        test_len = int(n_samples * self.test_size)

        if self.n_splits > 1:
            step = (n_samples - train_len - test_len - self.purge_gap) // (self.n_splits - 1)
        else:
            step = 0

        for i in range(self.n_splits):
            train_start = i * step
            train_end = train_start + train_len
            test_start = train_end + self.purge_gap
            test_end = test_start + test_len

            # Ensure the last fold includes the last sample
            if i == self.n_splits - 1:
                test_end = n_samples
                # Adjust train_start if needed to maintain train_len
                train_end = min(train_start + train_len, test_start)

            if test_start >= n_samples:
                break

            train_indices = np.arange(train_start, train_end)
            test_indices = np.arange(test_start, test_end)
            yield train_indices, test_indices
