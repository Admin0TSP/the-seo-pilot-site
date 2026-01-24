
// EmailJS Contact Form Submission
document.getElementById("contactForm").addEventListener("submit", function (e) {
  e.preventDefault();

  emailjs.sendForm('service_x943cgt', 'template_capb6qn', this)
    .then(() => {
      document.getElementById("contactForm").style.display = "none";
      document.getElementById("formMessage").style.display = "block";
    }, (error) => {
      alert('❌ Failed to send email. Please try again.');
      console.error('EmailJS Error:', error);
    });
});


// Mobile Nav Toggle
function toggleMenu() {
  document.getElementById("mobileNav").classList.toggle("active");
}

// Scroll-triggered Animations
document.addEventListener("DOMContentLoaded", () => {
  const animatedEls = document.querySelectorAll(
    ".fade-in, .fade-left, .fade-right, .slide-in-left, .slide-in-right, .fade-up"
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
  });

  animatedEls.forEach((el) => observer.observe(el));
});



