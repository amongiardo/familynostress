'use client';

import { Nav } from 'react-bootstrap';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaHome, FaUtensils, FaCalendarAlt, FaShoppingCart, FaCog, FaChartBar, FaComments } from 'react-icons/fa';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: FaHome },
  { href: '/calendario', label: 'Calendario', icon: FaCalendarAlt },
  { href: '/piatti', label: 'Piatti', icon: FaUtensils },
  { href: '/statistiche', label: 'Statistiche', icon: FaChartBar },
  { href: '/spesa', label: 'Lista Spesa', icon: FaShoppingCart },
  { href: '/chat', label: 'Chat', icon: FaComments },
  { href: '/impostazioni', label: 'Impostazioni', icon: FaCog },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="sidebar py-3">
      <Nav className="flex-column">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link key={item.href} href={item.href} passHref legacyBehavior>
              <Nav.Link
                className={`d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}
              >
                <Icon /> {item.label}
              </Nav.Link>
            </Link>
          );
        })}
      </Nav>
    </div>
  );
}
