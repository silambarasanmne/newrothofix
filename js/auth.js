/* ==========================================================================
   AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) WITH AUTO-LOGOUT
   ========================================================================== */

const Auth = {
  // Inactivity Auto-Logout Settings (15 Minutes Inactivity Limit)
  idleTimer: null,
  warningTimer: null,
  inactivityLimitMs: 15 * 60 * 1000,   // 15 Minutes
  warningThresholdMs: 14 * 60 * 1000,  // Warning at 14 Minutes

  getUser() {
    return API.getUser();
  },

  getToken() {
    return API.getToken();
  },

  getRoleLandingPage(role) {
    switch (role) {
      case 'Super Admin':
      case 'Admin / Billing Manager':
      case 'Admin':
        return 'dashboard.html';
      case 'Medical Manager':
      case 'Manager':
      case 'Billing Manager':
        return 'medicines.html';
      case 'Doctor':
        return 'doctor.html';
      case 'OP Worker':
        return 'register.html';
      case 'Medical Billing Worker':
      case 'Billing Worker':
        return 'billing.html';
      default:
        return 'billing.html';
    }
  },

  navigateToDashboard() {
    const user = API.getUser();
    if (user && user.role) {
      window.location.href = this.getRoleLandingPage(user.role);
    } else {
      window.location.href = 'index.html';
    }
  },

  initPageGuard() {
    const currentPath = window.location.pathname.toLowerCase();
    const isLoginPage = currentPath.endsWith('/') || currentPath.endsWith('/index.html') || currentPath.includes('login') || currentPath === '';
    const user = API.getUser();
    const token = API.getToken();

    if (!token || !user) {
      if (!isLoginPage) {
        window.location.href = 'index.html';
      }
      return;
    }

    // User is logged in
    if (isLoginPage) {
      window.location.href = this.getRoleLandingPage(user.role);
      return;
    }

    const role = user.role;
    const isSuperAdmin = role === 'Super Admin' || role === 'Admin / Billing Manager' || role === 'Admin';
    const isMedicalManager = role === 'Medical Manager' || role === 'Manager' || role === 'Billing Manager';
    const isBillingWorker = role === 'Medical Billing Worker' || role === 'Billing Worker';
    const isOPWorker = role === 'OP Worker';
    const isDoctor = role === 'Doctor';

    const pageName = currentPath.split('/').pop() || 'index.html';
    let isAllowed = false;

    if (isSuperAdmin) {
      isAllowed = true;
    } else if (isMedicalManager) {
      isAllowed = pageName.includes('medicines') || pageName.includes('reports') || pageName.includes('billing-manager');
    } else if (isBillingWorker) {
      isAllowed = pageName.includes('billing.html') || pageName.includes('history');
    } else if (isOPWorker) {
      isAllowed = pageName.includes('register') || pageName.includes('patients');
    } else if (isDoctor) {
      isAllowed = pageName.includes('doctor');
    }

    if (!isAllowed) {
      if (typeof UI !== 'undefined') UI.showToast(`Access Denied: ${role} is restricted from this page.`, 'warning');
      setTimeout(() => {
        window.location.href = this.getRoleLandingPage(role);
      }, 500);
      return;
    }

    this.renderSidebarAndHeader(user);
    this.initAutoLogout();
  },

  initAutoLogout() {
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.endsWith('/') || currentPath.endsWith('/index.html') || currentPath.includes('login') || currentPath === '';
    if (isLoginPage) return;

    // Reset timer on any user interaction
    const resetTimer = () => this.resetIdleTimer();

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => {
      window.addEventListener(evt, resetTimer, { passive: true });
    });

    this.resetIdleTimer();
  },

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);

    // Warning notification at 14 minutes of inactivity
    this.warningTimer = setTimeout(() => {
      if (typeof UI !== 'undefined') {
        UI.showToast('⚠️ Session expiring in 60 seconds due to inactivity. Move cursor or click to remain logged in.', 'warning');
      }
    }, this.warningThresholdMs);

    // Hard Auto-Logout execution at 15 minutes of inactivity
    this.idleTimer = setTimeout(() => {
      this.autoLogout();
    }, this.inactivityLimitMs);
  },

  autoLogout() {
    API.removeToken();
    if (typeof UI !== 'undefined') {
      UI.showToast('🔒 Auto Logged Out: Session expired due to inactivity.', 'info');
    }
    setTimeout(() => {
      window.location.href = 'index.html?reason=inactivity';
    }, 500);
  },

  renderSidebarAndHeader(user) {
    const userFullNameEl = document.getElementById('user-full-name');
    const userRoleEl = document.getElementById('user-role-badge') || document.getElementById('user-role-text');
    const userAvatarEl = document.getElementById('user-avatar') || document.getElementById('user-avatar-text');

    if (userFullNameEl && user.full_name) userFullNameEl.textContent = user.full_name;
    if (userRoleEl && user.role) userRoleEl.textContent = user.role;
    if (userAvatarEl && user.full_name) userAvatarEl.textContent = user.full_name.charAt(0).toUpperCase();

    // Hook up Dashboard button to redirect logged-in user to their role landing page
    const navDashboardLinks = document.querySelectorAll('#nav-dashboard');
    navDashboardLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateToDashboard();
      });
    });

    const role = user.role;
    const isSuperAdmin = role === 'Super Admin' || role === 'Admin / Billing Manager' || role === 'Admin';
    const isMedicalManager = role === 'Medical Manager' || role === 'Manager' || role === 'Billing Manager';
    const isBillingWorker = role === 'Medical Billing Worker' || role === 'Billing Worker';
    const isOPWorker = role === 'OP Worker';
    const isDoctor = role === 'Doctor';

    // Filter sidebar menu items strictly by role
    const sidebarMenu = document.querySelector('.sidebar-menu');
    if (sidebarMenu) {
      const menuItems = sidebarMenu.querySelectorAll('li');
      menuItems.forEach(li => {
        const link = li.querySelector('a');
        if (!link) return;

        const href = (link.getAttribute('href') || '').toLowerCase();
        let showLink = false;

        if (isSuperAdmin) {
          showLink = true;
        } else if (isMedicalManager) {
          showLink = href.includes('medicines') || href.includes('reports');
        } else if (isBillingWorker) {
          showLink = href.includes('billing.html') || href.includes('history');
        } else if (isOPWorker) {
          showLink = href.includes('register') || href.includes('patients');
        } else if (isDoctor) {
          showLink = href.includes('doctor');
        }

        if (showLink) {
          li.style.display = '';
        } else {
          li.style.display = 'none';
        }
      });

      // Auto-hide empty category headings
      const categories = sidebarMenu.querySelectorAll('.menu-category');
      categories.forEach(cat => {
        let nextEl = cat.nextElementSibling;
        let hasVisibleChild = false;
        while (nextEl && !nextEl.classList.contains('menu-category')) {
          if (nextEl.tagName === 'LI' && nextEl.style.display !== 'none') {
            hasVisibleChild = true;
            break;
          }
          nextEl = nextEl.nextElementSibling;
        }
        cat.style.display = hasVisibleChild ? '' : 'none';
      });
    }
  },

  async login(username, password) {
    try {
      const res = await API.post('/auth/login', { username, password });
      if (res.success) {
        API.setToken(res.token);
        API.setUser(res.user);
        if (typeof UI !== 'undefined') UI.showToast(`Welcome back, ${res.user.full_name}!`, 'success');
        
        setTimeout(() => {
          window.location.href = this.getRoleLandingPage(res.user.role);
        }, 500);
      }
    } catch (error) {
      if (typeof UI !== 'undefined') {
        UI.showToast(error.message || 'Login failed. Invalid username or password.', 'error');
      } else {
        alert(error.message || 'Login failed.');
      }
    }
  },

  promptAdminAuth() {
    const user = API.getUser();
    if (user && (user.role === 'Admin / Billing Manager' || user.role === 'Admin')) {
      window.location.href = 'billing-manager.html';
      return;
    }
    const modal = document.getElementById('modal-admin-auth');
    if (modal) {
      modal.classList.add('active');
      const input = document.getElementById('admin-password-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    } else {
      const password = prompt('🔐 Enter Admin Password to access Management Dashboard:');
      if (password) {
        this.verifyAdminPassword(password);
      }
    }
  },

  async verifyAdminPassword(password) {
    try {
      if (!password) {
        if (typeof UI !== 'undefined') UI.showToast('Please enter the Admin password.', 'warning');
        return;
      }
      const res = await API.post('/auth/login', { username: 'admin', password });
      if (res.success && (res.user.role === 'Admin / Billing Manager' || res.user.role === 'Admin')) {
        API.setToken(res.token);
        API.setUser(res.user);
        if (typeof UI !== 'undefined') UI.showToast('Admin Password Verified! Unlocking Admin Portal...', 'success');
        const modal = document.getElementById('modal-admin-auth');
        if (modal) modal.classList.remove('active');
        setTimeout(() => {
          window.location.href = 'billing-manager.html';
        }, 500);
      } else {
        if (typeof UI !== 'undefined') UI.showToast('Incorrect Admin password. Access denied.', 'error');
      }
    } catch (error) {
      if (typeof UI !== 'undefined') UI.showToast('Incorrect Admin password. Access denied.', 'error');
    }
  },

  logout() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    API.removeToken();
    if (typeof UI !== 'undefined') {
      UI.showToast('Logged out successfully.', 'info');
    }
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 400);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Auth.initPageGuard();
});

window.Auth = Auth;
