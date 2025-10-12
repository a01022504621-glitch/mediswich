document.addEventListener('DOMContentLoaded', () => {
    // 스크롤 시 요소 나타나기 애니메이션 (다양한 효과 감지)
    const animateElements = document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in');

    const observerOptions = {
        root: null, // 뷰포트를 기준으로 관찰
        rootMargin: '0px',
        threshold: 0.15 // 요소가 15% 보일 때 작동
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // 한 번 나타난 후에는 관찰 중지
            }
        });
    }, observerOptions);

    animateElements.forEach(el => {
        observer.observe(el);
    });

    // 헤더 스크롤 시 스타일 변경
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 80) { // 더 아래로 스크롤 될 때 변경
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // 로고와 nav item에 pop-in 애니메이션 적용 (초기 로드 시)
    const logo = document.querySelector('.logo');
    const navItems = document.querySelectorAll('.nav-item');
    const heroPrimaryCta = document.querySelector('.hero .cta-button.primary');
    const heroSecondaryCta = document.querySelector('.hero .cta-button.secondary');

    // 개별 요소에 애니메이션 클래스 추가 및 delay 적용
    // (CSS transition-delay와 연계)
    logo.classList.add('is-visible'); // 로고는 바로 보이게
    navItems.forEach((item, index) => {
        item.classList.add('fade-in-up'); // CSS transition-delay는 이미 HTML에 적용됨
        item.classList.add('is-visible'); // 로고와 함께 초기화면에서 보이게
    });
    // 영웅 섹션 CTA 버튼도 초기 로드 시 애니메이션
    if (heroPrimaryCta) {
        heroPrimaryCta.classList.add('is-visible');
    }
    if (heroSecondaryCta) {
        heroSecondaryCta.classList.add('is-visible');
    }

    // 아이콘 pop-in 애니메이션은 CSS keyframes으로 처리
    // IntersectionObserver가 이 클래스들을 감지하고 'is-visible'을 추가합니다.
    // CSS keyframes은 'is-visible'이 추가되는 즉시 발동합니다.
});