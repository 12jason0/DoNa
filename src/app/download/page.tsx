import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default function DownloadPage() {
    const headersList = headers();
    const userAgent = headersList.get('user-agent') || '';

    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /android/i.test(userAgent);

    if (isIOS) {
        redirect('https://apps.apple.com/us/app/%EB%91%90%EB%82%98/id6756777886');
    } else if (isAndroid) {
        redirect('https://play.google.com/store/apps/details?id=kr.io.dona.dona');
    } else {
        redirect('https://dona.io.kr');
    }
}
