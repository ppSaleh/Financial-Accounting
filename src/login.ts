import { createClient } from '@supabase/supabase-js'
import { loadCustodyList } from './CustodyList';

const loginForm = document.getElementById('login-form')!
const loginEmail = document.getElementById('login-email') as HTMLInputElement;
const loginPassword = document.getElementById('login-password') as HTMLInputElement;
const loginBtn = document.getElementById('login-btn')!;
const loginMessage = document.getElementById('login-message')!;
const listSec = document.getElementById('section-list')!;

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
    })
    if (error) {
        loginMessage.textContent = 'مشكلة بالتسجيل: ' + error.message
        loginMessage.classList = 'text-center p-1 border-2 border-red-400 border-dashed rounded-lg bg-red-50 text-red-600 w-4/5'
    } else {
        loginMessage.textContent = 'تم تسجيل الدخول بنجاح!'
        loginMessage.classList = 'text-center p-1 border-2 border-green-400 border-dashed rounded-lg bg-emerald-50 text-emerald-600 w-4/5'
        
        loadCustodyList();
        loginForm.classList.add('hidden');
        listSec.classList.remove('hidden');
    }
})

loginForm.classList.add('hidden');
listSec.classList.remove('hidden');