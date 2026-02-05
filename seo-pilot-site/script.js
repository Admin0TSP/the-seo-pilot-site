
// EmailJS Contact Form Submission
const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", function (e) {
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
}

// Mobile Nav Toggle
function toggleMenu() {
  document.getElementById("mobileNav").classList.toggle("active");
}

// FAQ Accordion Toggle
function toggleFaq(button) {
  const faqItem = button.closest('.faq-item');
  const isActive = faqItem.classList.contains('active');
  
  // Close all other FAQs
  document.querySelectorAll('.faq-item.active').forEach(item => {
    if (item !== faqItem) {
      item.classList.remove('active');
    }
  });
  
  // Toggle current FAQ
  faqItem.classList.toggle('active', !isActive);
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



