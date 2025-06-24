document.getElementById("contactForm").addEventListener("submit", function (e) {
  e.preventDefault();

  emailjs.sendForm('service_x943cgt', 'template_capb6qn', this)
    .then(function () {
      // Hide form
      document.getElementById("contactForm").style.display = "none";
      // Show message
      document.getElementById("formMessage").style.display = "block";
    }, function (error) {
      alert('❌ Failed to send email. Please try again.');
      console.error('EmailJS Error:', error);
    });
});

function toggleMenu() {
  document.getElementById('mobileNav').classList.toggle('active');
}
