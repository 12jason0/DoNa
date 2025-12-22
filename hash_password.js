// 비밀번호 해시 생성 스크립트
// 사용법: node hash_password.js

const bcrypt = require('bcryptjs');

async function hashPassword() {
    const plainPassword = 'test1234';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);
    
    console.log('='.repeat(50));
    console.log('원본 비밀번호:', plainPassword);
    console.log('해시된 비밀번호:', hashedPassword);
    console.log('='.repeat(50));
    console.log('\nNeon에서 실행할 SQL:');
    console.log(`UPDATE users SET password = '${hashedPassword}' WHERE email = 'test@test.com';`);
    console.log('='.repeat(50));
}

hashPassword().catch(console.error);

