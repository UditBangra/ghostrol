import { render } from 'preact';
import '../ui/tokens.css';
import './studio.css';
import { startSmoothScroll } from './scroll';
import { Studio } from './Studio';

startSmoothScroll();
render(<Studio />, document.getElementById('app')!);
