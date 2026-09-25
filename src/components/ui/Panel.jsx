// Kept for the call sites that predate Card. Same surface, same header.

import Card from "./Card";

function Panel(props) {
  return <Card {...props} />;
}

export default Panel;
