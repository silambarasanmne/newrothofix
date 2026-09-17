/* ==========================================================================
   BILLING MANAGER DASHBOARD MODULE
   ========================================================================== */

const BillingManager = {
  sales: [],
  selectedInvoice: null,

  init() {
    Auth.initPageGuard();
    this.bindEvents();
    this.loadBillingRecords();
  },

  bindEvents() {
    const btnRefresh = document.getElementById('btn-refresh-manager');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadBillingRecords());
    }

    const searchInput = document.getElementById('search-invoice-input');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => this.loadBillingRecords(), 250);
      });
    }

    const startDate = document.getElementById('filter-start-date');
    const endDate = document.getElementById('filter-end-date');
    const payMethod = document.getElementById('filter-payment-method');

    if (startDate) startDate.addEventListener('change', () => this.loadBillingRecords());
    if (endDate) endDate.addEventListener('change', () => this.loadBillingRecords());
    if (payMethod) payMethod.addEventListener('change', () => this.loadBillingRecords());

    const btnReprintPdf = document.getElementById('btn-reprint-pdf');
    if (btnReprintPdf) {
      btnReprintPdf.addEventListener('click', () => {
        if (this.selectedInvoice) {
          UI.downloadInvoicePdf(this.selectedInvoice);
        }
      });
    }
  },

  async loadBillingRecords() {
    try {
      const search = document.getElementById('search-invoice-input')?.value || '';
      const startDate = document.getElementById('filter-start-date')?.value || '';
      const endDate = document.getElementById('filter-end-date')?.value || '';
      const payMethod = document.getElementById('filter-payment-method')?.value || 'All';

      const params = new URLSearchParams();
      if (search) params.append('invoice_number', search);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (payMethod !== 'All') params.append('payment_method', payMethod);

      const res = await API.get(`/billing/history?${params.toString()}`);
      if (res.success) {
        this.sales = res.sales;
        this.renderTable();
        this.updateStats();
      } else {
        UI.showToast(res.message || 'Failed to load billing records', 'error');
      }
    } catch (error) {
      console.error('Billing Manager fetch error:', error);
      UI.showToast('Error loading billing records', 'error');
    }
  },

  updateStats() {
    let totalBilled = 0;
    let cashTotal = 0;
    let digitalTotal = 0;

    this.sales.forEach(s => {
      totalBilled += parseFloat(s.grand_total || 0);
      if (s.payment_method === 'Cash') {
        cashTotal += parseFloat(s.grand_total || 0);
      } else {
        digitalTotal += parseFloat(s.grand_total || 0);
      }
    });

    const totalBilledEl = document.getElementById('stat-total-billed');
    const totalCountEl = document.getElementById('stat-total-count');
    const splitInfoEl = document.getElementById('stat-split-info');
    const countBadgeEl = document.getElementById('records-count-badge');

    if (totalBilledEl) totalBilledEl.textContent = UI.formatCurrency(totalBilled);
    if (totalCountEl) totalCountEl.textContent = this.sales.length;
    if (splitInfoEl) splitInfoEl.textContent = `Cash: ${UI.formatCurrency(cashTotal)} | Digital: ${UI.formatCurrency(digitalTotal)}`;
    if (countBadgeEl) countBadgeEl.textContent = `Showing ${this.sales.length} invoices`;
  },

  renderTable() {
    const tbody = document.getElementById('managerTableBody');
    if (!tbody) return;

    if (this.sales.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="px-6 py-8 text-center text-slate-500">
            No billing records match your search criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.sales.map(s => {
      const formattedDate = UI.formatDateTime(s.created_at);
      const doctorName = s.doctor_name || 'Dr. Specialist';
      const billerName = s.worker_name || 'Staff';
      const checkoutStatus = s.checkout_status || 'Completed';

      return `
        <tr class="hover:bg-slate-900/60 transition-colors">
          <td class="px-6 py-3.5 font-mono font-bold text-teal-400">${s.invoice_number}</td>
          <td class="px-6 py-3.5 text-slate-400">${formattedDate}</td>
          <td class="px-6 py-3.5">
            <p class="font-semibold text-slate-200">${this.escapeHtml(s.customer_name || 'Walk-in Customer')}</p>
            <p class="text-[11px] text-slate-500">${this.escapeHtml(s.customer_phone || 'N/A')}</p>
          </td>
          <td class="px-6 py-3.5 font-medium text-teal-300">👨‍⚕️ ${this.escapeHtml(doctorName)}</td>
          <td class="px-6 py-3.5 text-slate-300">${this.escapeHtml(billerName)}</td>
          <td class="px-6 py-3.5 text-right font-extrabold text-slate-100">${UI.formatCurrency(s.grand_total)}</td>
          <td class="px-6 py-3.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.payment_method === 'Cash' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-cyan-950 text-cyan-400 border border-cyan-800'}">
              ${s.payment_method}
            </span>
          </td>
          <td class="px-6 py-3.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              ${checkoutStatus}
            </span>
          </td>
          <td class="px-6 py-3.5 text-right">
            <button onclick="BillingManager.viewInvoice(${s.id})" class="px-2.5 py-1 text-xs font-semibold text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 rounded-lg transition-colors inline-flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              View / Reprint
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async viewInvoice(saleId) {
    try {
      const res = await API.get(`/billing/invoice/${saleId}`);
      if (res.success && res.invoice) {
        this.selectedInvoice = res.invoice;
        const container = document.getElementById('invoice-detail-content');
        if (container) {
          container.innerHTML = UI.renderInvoiceHtml(res.invoice);
        }
        UI.openModal('modal-invoice-detail');
      } else {
        UI.showToast('Could not load invoice details', 'error');
      }
    } catch (error) {
      console.error('Fetch invoice error:', error);
      UI.showToast('Error loading invoice details', 'error');
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('managerTableBody')) {
    BillingManager.init();
  }
});

window.BillingManager = BillingManager;
