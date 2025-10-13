// 5. 초기 애니메이션 (헤더 로고와 메뉴) - DOMContentLoaded 밖에 배치하여 즉시 실행 시도
const runInitialAnimations = () => {
    // 모든 애니메이션 클래스를 초기 상태로 되돌립니다.
    document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in, .pop-in').forEach(el => {
        el.classList.remove('is-visible');
    });
    
    const logo = document.querySelector('.logo');
    if (logo) setTimeout(() => { logo.classList.add('is-visible'); }, 100);
    
    const ctaButton = document.querySelector('.header .cta-button');
    const navItems = document.querySelectorAll('.nav > a, .dropdown');
    
    let delay = 100;
    
    navItems.forEach((item) => {
        setTimeout(() => {
            item.classList.add('is-visible');
        }, delay);
        delay += 100;
    });

    if (ctaButton) {
        setTimeout(() => {
            ctaButton.classList.add('is-visible');
        }, delay);
    }
};

// script.js가 로드되면 초기 애니메이션 실행
runInitialAnimations();

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. 스크롤 시 요소 나타나기 애니메이션
    const animateElements = document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right, .scale-in, .bounce-in, .pop-in');

    const observerOptions = {
        root: null, 
        rootMargin: '0px',
        threshold: 0.15 
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // 한 번 보이면 관찰을 중단하여 불필요한 연산을 막습니다.
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    animateElements.forEach(el => {
        observer.observe(el);
    });
    
    // 2. 헤더 스크롤 시 스타일 변경
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 80) { 
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // ----------------------------------------------------
    // 3. CONTACT 모달 기능 구현 (모든 페이지에 공통 적용)
    const modal = document.getElementById('contact-modal');
    // 'open-contact-modal'로 시작하는 모든 ID를 찾습니다.
    const openBtns = document.querySelectorAll('[id^="open-contact-modal"]'); 
    const closeBtn = document.querySelector('.modal .close-button'); 
    const modalForm = document.getElementById('contact-form-modal'); 

    const openModal = (e) => {
        if (e) e.preventDefault(); 
        modal.classList.add('open'); // CSS 트랜지션을 위해 클래스 먼저 추가
        modal.style.display = 'flex'; // Flexbox를 사용하여 중앙 정렬
        document.body.style.overflow = 'hidden'; 
    };

    const closeModal = () => {
        modal.classList.remove('open');
        document.body.style.overflow = ''; 
        // 트랜지션이 끝난 후 display: none 처리 (CSS 트랜지션 시간과 일치시킴)
        setTimeout(() => {
             modal.style.display = 'none';
        }, 400); 
    };

    openBtns.forEach(btn => {
        btn.addEventListener('click', openModal);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // 모달 폼 제출 처리 (소개서 다운로드)
    if (modalForm) {
        modalForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            console.log("=== 소개서 다운로드 문의 데이터 수집 ===", data);
            alert(`[${data.name} 고객님] 문의가 접수되었습니다. 확인 후 이메일(${data.email})로 서비스 소개서를 보내드리겠습니다.`);
            this.reset(); 
            closeModal(); 
        });
    }

    // 4. Contact.html 페이지 폼 제출 처리
    const pageForm = document.getElementById('contact-form-page');
    if (pageForm) {
        pageForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            console.log("=== 페이지 문의 데이터 수집 ===", data);
            alert(`[${data.name} 고객님] 문의가 접수되었습니다. 신속하게 연락드리겠습니다.`);
            this.reset(); 
        });
    }
});