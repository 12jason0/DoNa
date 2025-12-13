"use server";

export async function checkAdminPassword(password: string): Promise<boolean> {
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    // 환경변수가 설정되지 않은 경우 보안을 위해 false 반환 (또는 로그 출력)
    if (!adminPassword) {
        console.error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.");
        return false;
    }

    return password === adminPassword;
}

