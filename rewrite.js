const fs = require('fs');
const path = 'c:/Users/hgvba/OneDrive/Pictures/Screenshots/torres-pest-control/src/services/userService.js';
let content = fs.readFileSync(path, 'utf8');

// Replace fetchAllAccounts
content = content.replace(/export async function fetchAllAccounts\(\) \{[\s\S]*?\n\}/, 
export async function fetchAllAccounts() {
  const { data, error } = await supabase.from('users').select(ACCOUNT_COLUMNS).order("created_at", { ascending: true });
  if (error) return { error: describeError(error), admins: [], staff: [], technicians: [] };
  
  const accounts = (data || []).map(row => mapAccountRow(row, row.role));
  return {
    error: null,
    admins: accounts.filter(a => a.role === ROLES.ADMIN),
    staff: accounts.filter(a => a.role === ROLES.STAFF),
    technicians: accounts.filter(a => a.role === ROLES.TECHNICIAN),
  };
});

// Replace createAccount
content = content.replace(/export async function createAccount\(sessionToken, role, fields\) \{[\s\S]*?return \{ account: mapAccountRow\(data, role\) \};\n\}/, 
export async function createAccount(sessionToken, role, fields) {
  const { data, error } = await supabase.rpc('create_user', {
    session_token: sessionToken,
    new_name: fields.name,
    new_username: fields.username || fields.email,
    new_email: fields.email,
    new_phone: fields.phone || null,
    new_password: fields.password,
    new_role: role
  });

  if (error) {
    if (error.code === "23505" || error.message.includes('already used')) {
      return { error: "That email or username is already used by another account." };
    }
    return { error: describeAccountRpcError(error, 'create_user') };
  }

  return { account: mapAccountRow(data, role) };
});

// Replace updateAccount
content = content.replace(/export async function updateAccount\(sessionToken, account, updatedFields\) \{[\s\S]*?return \{ account: mapped, updatedAt: data\.updated_at \};\n\}/, 
export async function updateAccount(sessionToken, account, updatedFields) {
  const { data, error } = await supabase.rpc('update_user', {
    session_token: sessionToken,
    target_id: account.id,
    new_name: updatedFields.name,
    new_email: updatedFields.email,
    new_phone: updatedFields.phone || null,
    new_role: updatedFields.role || account.role
  });

  if (error) {
    if (error.code === "23505" || error.message.includes('already used')) {
      return { error: "That email is already used by another account." };
    }
    return { error: describeAccountRpcError(error, 'update_user') };
  }

  return { account: mapAccountRow(data, data.role), updatedAt: data.updated_at };
});

// Replace setAccountStatus
content = content.replace(/export async function setAccountStatus\(sessionToken, account, nextStatus\) \{[\s\S]*?return \{ account: mapAccountRow\(data, account\.role\), updatedAt: data\.updated_at \};\n\}/, 
export async function setAccountStatus(sessionToken, account, nextStatus) {
  const { data, error } = await supabase.rpc('set_user_status', {
    session_token: sessionToken,
    target_id: account.id,
    new_status: nextStatus
  });

  if (error) return { error: describeAccountRpcError(error, 'set_user_status') };
  return { account: mapAccountRow(data, data.role), updatedAt: data.updated_at };
});

// Update mapAccountRow signature if needed
content = content.replace(/export function mapAccountRow\(row, role\) \{/, 'export function mapAccountRow(row, role) {');

fs.writeFileSync(path, content, 'utf8');
