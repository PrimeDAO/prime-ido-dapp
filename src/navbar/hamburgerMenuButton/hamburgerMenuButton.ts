import { bindable } from "aurelia-framework";
import "./hamburgerMenuButton.scss";

export class HamburgerMenuButton {
  @bindable isOpen: boolean;
}
