import { createClient } from '@supabase/supabase-js';
import { loadCustodyList } from './CustodyList';
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginMessage = document.getElementById('login-message');
const listSec = document.getElementById('section-list');
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
    console.log(email + password);
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (error) {
        loginMessage.textContent = 'مشكلة بالتسجيل: ' + error.message;
        loginMessage.classList = 'text-center p-1 border-2 border-red-400 border-dashed rounded-lg bg-red-50 text-red-600 w-4/5';
    }
    else {
        loginMessage.textContent = 'تم تسجيل الدخول بنجاح!';
        loginMessage.classList = 'text-center p-1 border-2 border-green-400 border-dashed rounded-lg bg-emerald-50 text-emerald-600 w-4/5';
    }
});
loginForm.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        loginBtn.click();
    }
});
async function showApp() {
    await loadCustodyList();
    loginForm.classList.add('hidden');
    listSec.classList.remove('hidden');
}
function showLogin() {
    loginForm.classList.remove('hidden');
    listSec.classList.add('hidden');
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
const displayNameOverlay = document.getElementById('displayname-overlay');
const displayNameInput = document.getElementById('displayname-input');
const displayNameConfirm = document.getElementById('displayname-confirm');
const displayNameCancel = document.getElementById('displayname-cancel');
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
function showDisplayNamePrompt(force = false) {
    if (force) {
        displayNameCancel.classList.add('hidden');
        displayNameOverlay.classList.add('forced');
    }
    else {
        displayNameCancel.classList.remove('hidden');
        displayNameOverlay.classList.remove('forced');
    }
    displayNameOverlay.classList.remove('hidden');
    return false;
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
// Session & Auth
async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    console.log(session);
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
