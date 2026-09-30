import { createClient } from '@supabase/supabase-js';
import { loadCustodies } from './custodies';
export { supabaseClient, isSupervisor };
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginMessage = document.getElementById('login-message');
const custodiesTable = document.getElementById('custodies-table');
const SUPABASE_URL = 'https://cwandpojkiljwqihjutj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aDVuZu2kdkpmqPaNUx7q2w_grXhjndk';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value;
    const password = loginPassword.value;
    if (!email || !password) {
        alert('Please fill out the form.');
        return;
    }
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (error) {
        loginMessage.textContent = 'مشكلة بالتسجيل: ' + error.message;
        loginMessage.classList = 'w-full flex justify-center text-center p-1 border-2 border-red-400 border-dashed rounded-lg bg-red-50 text-red-600 w-4/5';
    }
    else {
        loginMessage.textContent = 'تم تسجيل الدخول بنجاح!';
        loginMessage.classList = 'w-full flex justify-center text-center p-1 border-2 border-green-400 border-dashed rounded-lg bg-emerald-50 text-emerald-600 w-4/5';
    }
});
loginForm.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        loginBtn.click();
    }
});
function showApp() {
    loginForm.classList.add('hidden');
    custodiesTable.classList.remove('hidden');
    loadCustodies();
}
function showLogin() {
    loginForm.classList.remove('hidden');
    custodiesTable.classList.add('hidden');
    profileMenu.classList.add('hidden');
}
// Profile
const profileMenu = document.getElementById("profile-menu");
const profileToggle = document.getElementById("profile-toggle");
const profileOptions = document.getElementById("profile-options");
const Displayname = document.getElementById('display-name');
const changeDisplaynameBtn = document.getElementById('profile-change-displayname');
const profileRole = document.getElementById('profile-role');
const logoutBtn = document.getElementById('profile-logout');
let open = false;
let profile;
function isSupervisor() {
    return profile?.role === 'Supervisor';
}
async function buildprofile() {
    if (!profile) {
        console.error('No profile found.');
        profileMenu.classList.add('hidden');
        Displayname.textContent = 'اسم العرض';
        profileRole.textContent = `الرتبة: خطأ`;
        return;
    }
    if (profile.display_name === null && !showDisplayNamePrompt(true)) {
        profile.display_name = 'اسم العرض';
    }
    profileMenu.classList.remove('hidden');
    Displayname.textContent = profile.display_name;
    profileRole.textContent = `الرتبة: ${isSupervisor() ? 'مشرف' : 'موظف'}`;
}
async function fetchProfile(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, role, display_name')
        .eq('id', userId)
        .single();
    if (error) {
        console.error('Failed to fetch profile:', error);
        return null;
    }
    return data;
}
profileToggle.addEventListener("click", () => {
    open = !open;
    profileOptions.classList.toggle("opacity-0", !open);
    profileOptions.classList.toggle("-translate-y-2", !open);
    profileOptions.classList.toggle("pointer-events-none", !open);
    profileOptions.inert = !open;
    profileToggle.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (event) => {
    if (open &&
        event.target instanceof Node &&
        !profileToggle.parentElement?.contains(event.target)) {
        open = false;
        profileOptions.classList.add("opacity-0", "-translate-y-2", "pointer-events-none");
        profileOptions.inert = true;
        profileToggle.setAttribute("aria-expanded", "false");
    }
});
logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error(error);
        return;
    }
    profileToggle.click();
    showLogin();
});
changeDisplaynameBtn.addEventListener('click', () => showDisplayNamePrompt());
// Display name
const displayNameOverlay = document.getElementById('displayname-overlay');
const displayNameInput = document.getElementById('displayname-input');
const displayNameConfirm = document.getElementById('displayname-confirm');
const displayNameCancel = document.getElementById('displayname-cancel');
const displayNameStatus = document.getElementById('displayname-status');
let isSavingDisplayName = false;
function showDisplayNamePrompt(force = false) {
    if (isSavingDisplayName)
        return false;
    displayNameStatus.textContent = '';
    displayNameInput.setCustomValidity('');
    if (force) {
        displayNameCancel.classList.add('hidden');
        displayNameOverlay.classList.add('forced');
    }
    else {
        displayNameCancel.classList.remove('hidden');
        displayNameOverlay.classList.remove('forced');
    }
    displayNameInput.value = profile?.display_name ?? '';
    displayNameOverlay.showModal();
    displayNameInput.focus();
    return false;
}
displayNameConfirm.addEventListener('click', async () => {
    if (isSavingDisplayName)
        return;
    const name = displayNameInput.value.trim();
    displayNameInput.setCustomValidity(name ? '' : 'يرجى إدخال اسم العرض');
    if (!displayNameInput.reportValidity())
        return;
    if (name === (profile?.display_name ?? '').trim())
        return;
    if (!profile?.id)
        return;
    const userId = profile.id;
    const buttonText = displayNameConfirm.textContent;
    isSavingDisplayName = true;
    displayNameConfirm.disabled = true;
    displayNameCancel.disabled = true;
    displayNameInput.disabled = true;
    displayNameConfirm.textContent = 'جارٍ الحفظ…';
    displayNameConfirm.classList.add('animate-pulse');
    displayNameConfirm.setAttribute('aria-busy', 'true');
    displayNameStatus.textContent = 'جارٍ حفظ اسم العرض…';
    try {
        if (!await saveDisplayName(userId, name)) {
            displayNameStatus.textContent = 'تعذر حفظ اسم العرض. يرجى المحاولة مرة أخرى.';
            return;
        }
        displayNameOverlay.close();
        if (profile?.id === userId) {
            profile.display_name = name;
            Displayname.textContent = name;
        }
        displayNameOverlay.classList.remove('forced');
        displayNameCancel.classList.remove('hidden');
    }
    catch (error) {
        console.error('Failed to save display name:', error);
        displayNameStatus.textContent = 'تعذر حفظ اسم العرض. يرجى المحاولة مرة أخرى.';
    }
    finally {
        isSavingDisplayName = false;
        displayNameConfirm.disabled = false;
        displayNameCancel.disabled = false;
        displayNameInput.disabled = false;
        displayNameConfirm.textContent = buttonText;
        displayNameConfirm.classList.remove('animate-pulse');
        displayNameConfirm.removeAttribute('aria-busy');
    }
});
displayNameCancel.addEventListener('click', () => {
    if (isSavingDisplayName)
        return;
    displayNameOverlay.close();
});
displayNameOverlay.addEventListener('cancel', (event) => {
    if (isSavingDisplayName || displayNameOverlay.classList.contains('forced')) {
        event.preventDefault();
    }
});
displayNameInput.addEventListener('input', () => {
    displayNameInput.setCustomValidity('');
    displayNameStatus.textContent = '';
});
const displayNameLayout = document.getElementById('displayname-overlay-layout');
let displayNameMouseDownTarget = null;
displayNameOverlay.addEventListener('mousedown', (event) => {
    displayNameMouseDownTarget = event.target;
});
displayNameOverlay.addEventListener('mouseup', (event) => {
    const clickedBackdrop = event.target === displayNameOverlay ||
        event.target === displayNameLayout;
    if (event.button === 0 &&
        event.target === displayNameMouseDownTarget &&
        clickedBackdrop &&
        !isSavingDisplayName &&
        !displayNameOverlay.classList.contains('forced')) {
        displayNameOverlay.close();
    }
    displayNameMouseDownTarget = null;
});
async function saveDisplayName(userId, name) {
    const trimmed = name.trim();
    if (!trimmed)
        return false; // don't let them submit blank
    const { error } = await supabaseClient
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', userId);
    if (error) {
        console.error('Failed to save display name:', error);
        return false;
    }
    return true;
}
// Session & Auth
async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        profile = await fetchProfile(session.user.id);
        buildprofile();
        showApp();
    }
    else {
        showLogin();
    }
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            profile = await fetchProfile(session.user.id);
            buildprofile();
            showApp();
        }
        if (event === 'SIGNED_OUT') {
            profile = null;
            showLogin();
        }
    });
}
initSession();
