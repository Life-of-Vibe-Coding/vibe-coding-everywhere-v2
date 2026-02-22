import Link from 'next/link';
import { Facebook, Twitter, Instagram, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="glass-card mt-20 border-t-2 border-primary/30" role="contentinfo">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-heading font-bold text-2xl mb-4 bg-gradient-to-r from-cta to-accent bg-clip-text text-transparent">
              ShopHub
            </h3>
            <p className="font-body text-text-muted text-sm leading-relaxed">
              Your one-stop shop for premium products at amazing prices.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-4 text-text">Quick Links</h4>
            <ul className="space-y-2 font-body text-sm">
              <li>
                <Link href="/" className="text-text-muted hover:text-cta transition-smooth cursor-pointer">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-text-muted hover:text-cta transition-smooth cursor-pointer">
                  Products
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-text-muted hover:text-cta transition-smooth cursor-pointer">
                  Cart
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-4 text-text">Customer Service</h4>
            <ul className="space-y-2 font-body text-sm">
              <li>
                <a href="#contact" className="text-text-muted hover:text-cta transition-smooth cursor-pointer">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#shipping" className="text-text-muted hover:text-cta transition-smooth cursor-pointer">
                  Shipping Info
                </a>
              </li>
              <li>
                <a href="#returns" className="text-text-muted hover:text-cta transition-smooth cursor-pointer">
                  Returns
                </a>
              </li>
              <li>
                <a href="#faq" className="text-text-muted hover:text-cta transition-smooth cursor-pointer">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-4 text-text">Follow Us</h4>
            <div className="flex space-x-4">
              <a
                href="https://facebook.com"
                className="p-2.5 bg-primary/20 hover:bg-gradient-to-r hover:from-cta hover:to-accent rounded-lg transition-smooth cursor-pointer group"
                aria-label="Follow us on Facebook"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Facebook className="w-5 h-5 text-text group-hover:text-gray-900 transition-smooth" aria-hidden="true" />
              </a>
              <a
                href="https://twitter.com"
                className="p-2.5 bg-primary/20 hover:bg-gradient-to-r hover:from-cta hover:to-accent rounded-lg transition-smooth cursor-pointer group"
                aria-label="Follow us on Twitter"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter className="w-5 h-5 text-text group-hover:text-gray-900 transition-smooth" aria-hidden="true" />
              </a>
              <a
                href="https://instagram.com"
                className="p-2.5 bg-primary/20 hover:bg-gradient-to-r hover:from-cta hover:to-accent rounded-lg transition-smooth cursor-pointer group"
                aria-label="Follow us on Instagram"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="w-5 h-5 text-text group-hover:text-gray-900 transition-smooth" aria-hidden="true" />
              </a>
              <a
                href="mailto:contact@shophub.com"
                className="p-2.5 bg-primary/20 hover:bg-gradient-to-r hover:from-cta hover:to-accent rounded-lg transition-smooth cursor-pointer group"
                aria-label="Email us"
              >
                <Mail className="w-5 h-5 text-text group-hover:text-gray-900 transition-smooth" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-primary/30 mt-8 pt-8 text-center">
          <p className="font-body text-sm text-text-muted">
            © {new Date().getFullYear()} <span className="font-semibold text-text">ShopHub</span>. All rights reserved. Made with ❤️ for amazing shoppers.
          </p>
        </div>
      </div>
    </footer>
  );
}
