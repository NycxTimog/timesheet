(function () {
  const client = () => window.supabaseClient;
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const jsString = (value = '') => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n]/g, ' ');

  async function load() {
    if (!window.currentProfile || !client()) return [];
    let query = client().from('profiles')
      .select('id, full_name, email, role, is_active, created_at')
      .order('full_name', { ascending: true });
    if (window.currentProfile.role !== 'employer') {
      query = query.eq('id', window.currentProfile.id);
    } else {
      query = query.eq('role', 'employee');
    }
    const { data: profiles, error } = await query;
    if (error) throw error;
    const mapped = (profiles || []).map((profile) => ({
      id: profile.id,
      name: profile.full_name,
      email: profile.email || '',
      created_at: profile.created_at,
      role: profile.role,
      is_active: profile.is_active,
      scheduleIn: '09:00',
      scheduleOut: '18:00',
      breakHours: 1
    }));
    if (window.currentProfile.role === 'employer') {
      window.data.employees = mapped;
    } else {
      window.data.employees = mapped;
      window.data.currentUser = window.currentProfile.id;
    }
    if (!mapped.some((employee) => employee.id === window.selectedEmployee)) {
      window.selectedEmployee = mapped[0]?.id || '';
    }
    return mapped;
  }

  async function invokeEmployerAction(body) {
    const { data, error } = await client().functions.invoke('manage-employee', { body });
    if (error) throw new Error(error.message || 'Employee management request failed.');
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function updateName(id, fullName) {
    if (!fullName) throw new Error('Enter the employee’s name.');
    await invokeEmployerAction({ action: 'update', employee_id: id, full_name: fullName });
  }

  async function setActive(id, isActive) {
    await invokeEmployerAction({ action: 'set_active', employee_id: id, is_active: isActive });
  }

  function renderDirectory() {
    const host = document.getElementById('employeeDirectory');
    const count = document.getElementById('employeeCount');
    if (!host) return;
    const search = (document.getElementById('employeeSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('employeeStatus')?.value || 'all';
    const employees = (window.data?.employees || []).filter((employee) => {
      const matchesSearch = `${employee.name} ${employee.email}`.toLowerCase().includes(search);
      const matchesStatus = status === 'all' || (status === 'active' ? employee.is_active : !employee.is_active);
      return matchesSearch && matchesStatus;
    });
    if (count) count.textContent = `${window.data?.employees?.length || 0} employee account(s)`;
    if (!employees.length) {
      host.innerHTML = '<div class="empty">No employee accounts match your search.</div>';
      return;
    }
    host.innerHTML = `<div class="table-wrap"><table style="min-width:760px"><thead><tr><th>Employee</th><th>Account status</th><th>Added</th><th>Actions</th></tr></thead><tbody>${employees.map((employee) => {
      const initials = employee.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
      const created = employee.created_at ? new Date(employee.created_at).toLocaleDateString() : '—';
      const active = employee.is_active;
      return `<tr><td><div class="employee-card"><div class="avatar">${escapeHtml(initials)}</div><div><b>${escapeHtml(employee.name)}</b><div class="small">${escapeHtml(employee.email || 'No email on profile')}</div></div></div></td><td><span class="status ${active ? 's-present' : 's-absent'}">${active ? 'ACTIVE' : 'DEACTIVATED'}</span></td><td>${created}</td><td><div class="toolbar"><button class="btn" onclick="editEmployee('${employee.id}','${escapeHtml(jsString(employee.name))}')">Edit</button><button class="btn" disabled title="Available when attendance records are connected to Supabase">View history</button><button class="btn ${active ? 'danger' : ''}" onclick="toggleEmployee('${employee.id}',${active},'${escapeHtml(jsString(employee.name))}')">${active ? 'Deactivate' : 'Reactivate'}</button></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  async function openDirectory() {
    const host = document.getElementById('employeeDirectory');
    if (!host) return;
    host.innerHTML = '<div class="empty">Loading employee profiles…</div>';
    try {
      await load();
      renderDirectory();
      document.getElementById('employeeSearch')?.addEventListener('input', renderDirectory);
      document.getElementById('employeeStatus')?.addEventListener('change', renderDirectory);
    } catch (error) {
      host.innerHTML = `<div class="empty">Could not load employee profiles: ${escapeHtml(error.message)}<br><span class="small">Check that the database migration has been applied and the employer profile has permission to read employee profiles.</span></div>`;
    }
  }

  window.employeeAdmin = { load, updateName, setActive, renderDirectory, openDirectory };
  window.addEventListener('DOMContentLoaded', () => {});
})();
