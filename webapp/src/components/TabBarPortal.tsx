import { createPortal } from 'react-dom';
import TabBar from './Layout/TabBar';

export default function TabBarPortal() {
  return createPortal(<TabBar />, document.body);
}
