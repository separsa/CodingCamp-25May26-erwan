/**
 * Expense & Budget Visualizer
 * Vanilla JS · Local Storage · Chart.js
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ebv_transactions';
  const THEME_KEY = 'ebv_theme';
  const LIMIT_KEY = 'ebv_spending_limit';

  const CATEGORIES = ['Food', 'Transport', 'Fun'];
  const CHART_COLORS = {
    Food: '#2563eb',
    Transport: '#059669',
    Fun: '#d97706',
  };

  const DOM = {
    html: document.documentElement,
    form: document.getElementById('transaction-form'),
    itemName: document.getElementById('item-name'),
    itemAmount: document.getElementById('item-amount'),
    itemCategory: document.getElementById('item-category'),
    formError: document.getElementById('form-error'),
    totalBalance: document.getElementById('total-balance'),
    transactionsList: document.getElementById('transactions-list'),
    transactionCount: document.getElementById('transaction-count'),
    sortBy: document.getElementById('sort-by'),
    spendingLimit: document.getElementById('spending-limit'),
    themeToggle: document.getElementById('theme-toggle'),
    chartCanvas: document.getElementById('spending-chart'),
    chartWrapper: document.querySelector('.chart-wrapper'),
  };

  let transactions = [];
  let spendingChart = null;

  /* --------------------------------------------------------------------------
     Local Storage
     -------------------------------------------------------------------------- */
  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }

  function loadTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  function saveTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  }

  function loadSpendingLimit() {
    const raw = localStorage.getItem(LIMIT_KEY);
    if (raw === null) return null;
    const value = parseFloat(raw);
    return Number.isFinite(value) && value >= 1 ? value : null;
  }

  function saveSpendingLimit(limit) {
    localStorage.setItem(LIMIT_KEY, String(limit));
  }

  /* --------------------------------------------------------------------------
     Utilities
     -------------------------------------------------------------------------- */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function escapeHtml(str) {
    const el = document.createElement('div');
    el.textContent = str;
    return el.innerHTML;
  }

  function getSpendingLimit() {
    const value = parseFloat(DOM.spendingLimit.value);
    return Number.isFinite(value) && value >= 1 ? value : 100;
  }

  function isDarkTheme() {
    return DOM.html.getAttribute('data-theme') === 'dark';
  }

  function getChartTextColor() {
    return isDarkTheme() ? '#e8edf2' : '#1a2332';
  }

  /* --------------------------------------------------------------------------
     Validation & Form
     -------------------------------------------------------------------------- */
  function validateForm(name, amountStr, category) {
    if (!name.trim()) {
      return 'Please enter an item name.';
    }
    if (!amountStr.trim()) {
      return 'Please enter an amount.';
    }
    const amount = parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      return 'Amount must be greater than zero.';
    }
    if (!category) {
      return 'Please select a category.';
    }
    return null;
  }

  function showFormError(message) {
    if (message) {
      DOM.formError.textContent = message;
      DOM.formError.hidden = false;
    } else {
      DOM.formError.textContent = '';
      DOM.formError.hidden = true;
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    const name = DOM.itemName.value;
    const amountStr = DOM.itemAmount.value;
    const category = DOM.itemCategory.value;
    const error = validateForm(name, amountStr, category);

    if (error) {
      showFormError(error);
      return;
    }

    showFormError(null);
    transactions.push({
      id: generateId(),
      name: name.trim(),
      amount: parseFloat(amountStr),
      category: category,
      createdAt: Date.now(),
    });
    saveTransactions();

    DOM.form.reset();
    DOM.itemCategory.selectedIndex = 0;
    renderAll();
  }

  /* --------------------------------------------------------------------------
     Transactions CRUD & Sort
     -------------------------------------------------------------------------- */
  function deleteTransaction(id) {
    transactions = transactions.filter(function (tx) {
      return tx.id !== id;
    });
    saveTransactions();
    renderAll();
  }

  function getSortedTransactions() {
    const sorted = transactions.slice();
    const sortValue = DOM.sortBy.value;

    switch (sortValue) {
      case 'amount-asc':
        return sorted.sort(function (a, b) { return a.amount - b.amount; });
      case 'amount-desc':
        return sorted.sort(function (a, b) { return b.amount - a.amount; });
      case 'category-asc':
        return sorted.sort(function (a, b) { return a.category.localeCompare(b.category); });
      case 'category-desc':
        return sorted.sort(function (a, b) { return b.category.localeCompare(a.category); });
      default:
        return sorted.sort(function (a, b) { return b.createdAt - a.createdAt; });
    }
  }

  function getCategoryTotals() {
    const totals = { Food: 0, Transport: 0, Fun: 0 };
    transactions.forEach(function (tx) {
      if (Object.prototype.hasOwnProperty.call(totals, tx.category)) {
        totals[tx.category] += tx.amount;
      }
    });
    return totals;
  }

  /* --------------------------------------------------------------------------
     Render UI
     -------------------------------------------------------------------------- */
  function renderBalance() {
    const total = transactions.reduce(function (sum, tx) {
      return sum + tx.amount;
    }, 0);
    DOM.totalBalance.textContent = formatCurrency(total);
  }

  function renderTransactionList() {
    const sorted = getSortedTransactions();
    const limit = getSpendingLimit();
    const count = sorted.length;

    DOM.transactionCount.textContent = count === 1 ? '1 item' : count + ' items';
    DOM.transactionsList.innerHTML = '';

    if (count === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No transactions yet. Add your first expense above.';
      DOM.transactionsList.appendChild(empty);
      return;
    }

    sorted.forEach(function (tx) {
      const item = document.createElement('div');
      item.className = 'transaction-item';
      item.setAttribute('role', 'listitem');

      if (tx.amount > limit) {
        item.classList.add('transaction-item--over-limit');
      }

      const info = document.createElement('div');
      info.className = 'transaction-item__info';

      const nameEl = document.createElement('p');
      nameEl.className = 'transaction-item__name';
      nameEl.textContent = tx.name;

      const metaEl = document.createElement('p');
      metaEl.className = 'transaction-item__meta';
      metaEl.textContent = tx.category;

      info.appendChild(nameEl);
      info.appendChild(metaEl);

      const amountEl = document.createElement('span');
      amountEl.className = 'transaction-item__amount';
      amountEl.textContent = formatCurrency(tx.amount);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn--danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', 'Delete ' + tx.name);
      deleteBtn.addEventListener('click', function () {
        deleteTransaction(tx.id);
      });

      item.appendChild(info);
      item.appendChild(amountEl);
      item.appendChild(deleteBtn);
      DOM.transactionsList.appendChild(item);
    });
  }

  function renderChart() {
    const hasData = transactions.length > 0;
    const totals = getCategoryTotals();
    const labels = CATEGORIES.filter(function (cat) {
      return totals[cat] > 0;
    });
    const data = labels.map(function (cat) {
      return totals[cat];
    });
    const colors = labels.map(function (cat) {
      return CHART_COLORS[cat];
    });

    if (hasData) {
      DOM.chartWrapper.classList.add('has-data');
    } else {
      DOM.chartWrapper.classList.remove('has-data');
      if (spendingChart) {
        spendingChart.destroy();
        spendingChart = null;
      }
      return;
    }

    const borderColor = isDarkTheme() ? '#1a2332' : '#ffffff';
    const textColor = getChartTextColor();

    if (spendingChart) {
      spendingChart.data.labels = labels;
      spendingChart.data.datasets[0].data = data;
      spendingChart.data.datasets[0].backgroundColor = colors;
      spendingChart.data.datasets[0].borderColor = borderColor;
      spendingChart.options.plugins.legend.labels.color = textColor;
      spendingChart.update();
      return;
    }

    spendingChart = new Chart(DOM.chartCanvas, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: borderColor,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              padding: 16,
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.raw;
                const sum = data.reduce(function (acc, n) { return acc + n; }, 0);
                const pct = ((value / sum) * 100).toFixed(1);
                return ' ' + context.label + ': ' + formatCurrency(value) + ' (' + pct + '%)';
              },
            },
          },
        },
      },
    });
  }

  function renderAll() {
    renderBalance();
    renderTransactionList();
    renderChart();
  }

  /* --------------------------------------------------------------------------
     Theme Toggle
     -------------------------------------------------------------------------- */
  function applyTheme(theme) {
    if (theme === 'dark') {
      DOM.html.setAttribute('data-theme', 'dark');
      DOM.themeToggle.setAttribute('aria-pressed', 'true');
    } else {
      DOM.html.removeAttribute('data-theme');
      DOM.themeToggle.setAttribute('aria-pressed', 'false');
    }
    saveTheme(theme);
    if (spendingChart) {
      renderChart();
    }
  }

  function toggleTheme() {
    applyTheme(isDarkTheme() ? 'light' : 'dark');
  }

  /* --------------------------------------------------------------------------
     Event Bindings & Init
     -------------------------------------------------------------------------- */
  function bindEvents() {
    DOM.form.addEventListener('submit', handleFormSubmit);
    DOM.sortBy.addEventListener('change', renderTransactionList);
    DOM.spendingLimit.addEventListener('input', function () {
      renderTransactionList();
    });
    DOM.spendingLimit.addEventListener('change', function () {
      saveSpendingLimit(getSpendingLimit());
      renderTransactionList();
    });
    DOM.themeToggle.addEventListener('click', toggleTheme);
  }

  function init() {
    transactions = loadTransactions();

    const savedTheme = loadTheme();
    if (savedTheme === 'dark' || savedTheme === 'light') {
      applyTheme(savedTheme);
    }

    const savedLimit = loadSpendingLimit();
    if (savedLimit !== null) {
      DOM.spendingLimit.value = savedLimit;
    }

    bindEvents();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
