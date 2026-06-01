import type { Viewport } from "@xyflow/react";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./canvasTypes";

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  defaultProjectName: string;
  projectDescription: string;
  viewport: Viewport;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
};

type TemplateNodeInput = {
  id: string;
  canvasType: CanvasNodeType;
  title: string;
  x: number;
  y: number;
  tags: string[];
  content: string;
};

type TemplateEdgeInput = {
  id: string;
  source: string;
  target: string;
  relationship: string;
};

function node(input: TemplateNodeInput): CanvasFlowNode {
  return {
    id: input.id,
    type: "contextNode",
    position: { x: input.x, y: input.y },
    data: {
      canvasType: input.canvasType,
      title: input.title,
      tags: input.tags,
      updatedAt: "",
      fields: { content: input.content },
    },
  };
}

function edge(input: TemplateEdgeInput): CanvasFlowEdge {
  return {
    id: input.id,
    type: "default",
    source: input.source,
    target: input.target,
    label: input.relationship,
    data: { relationship: input.relationship, updatedAt: "" },
  };
}

const BASIC_SALES_ECOMMERCE_TEMPLATE: ProjectTemplate = {
  id: "basic-sales-ecommerce",
  name: "Sales E-commerce App",
  description: "Small storefront with products, cart, checkout, and order tracking.",
  defaultProjectName: "Sales E-commerce App",
  projectDescription: "Sample client contract for a simple online sales platform.",
  viewport: { x: 120, y: 90, zoom: 0.82 },
  nodes: [
    node({
      id: "tpl_sales_contract",
      canvasType: "project_contract",
      title: "Sales E-commerce App Contract",
      x: 80,
      y: 80,
      tags: ["client-contract", "source-of-truth"],
      content:
        "Build a responsive web app for a small retail client to sell products online and manage basic sales operations.\n\nScope includes product catalog browsing, customer cart, Stripe checkout, order confirmation, customer order history, and a simple admin area for products, inventory counts, and order status.\n\nThe first release should support one store, one currency, manual shipping status updates, and email confirmations. Marketplace selling, subscriptions, coupons, tax automation, warehouse fulfilment, and advanced reporting are out of scope unless added through a later change request.",
    }),
    node({
      id: "tpl_sales_client_brief",
      canvasType: "source_snapshot",
      title: "Client Sales Brief",
      x: -320,
      y: -20,
      tags: ["client", "brief"],
      content:
        "Client request summary: the business currently tracks orders in spreadsheets and wants a lightweight online store.\n\nTop priorities are product listings with photos, stock counts, card payments, order emails, and an admin screen that non-technical staff can use.\n\nTarget launch: 6-8 weeks. Initial catalog: about 80 products. Expected traffic: low to moderate local customer traffic.",
    }),
    node({
      id: "tpl_sales_estimate",
      canvasType: "source_snapshot",
      title: "Initial Estimate Notes",
      x: -310,
      y: 300,
      tags: ["estimate", "planning"],
      content:
        "Planning notes: use a hosted payment provider so card details never touch the app server. Keep the admin panel narrow for phase 1: product CRUD, stock count, order list, and status updates.\n\nEstimate should separate frontend storefront, backend APIs, payment integration, admin screens, QA/UAT, and launch support.",
    }),
    node({
      id: "tpl_sales_wireframe",
      canvasType: "link",
      title: "Storefront Wireframe Link",
      x: 80,
      y: -160,
      tags: ["design"],
      content:
        "https://example.com/storefront-wireframe\n\nPlaceholder for product listing, product detail, cart, checkout, order confirmation, and admin order list wireframes.",
    }),
    node({
      id: "tpl_sales_req_catalog",
      canvasType: "requirement",
      title: "Product Catalog",
      x: 540,
      y: -120,
      tags: ["frontend", "backend"],
      content:
        "Customers can browse products, search by keyword, filter by category, and open a detail page with images, description, price, and stock availability. Admins can add, edit, archive, and restock products.",
    }),
    node({
      id: "tpl_sales_req_cart_checkout",
      canvasType: "requirement",
      title: "Cart And Checkout",
      x: 560,
      y: 120,
      tags: ["checkout", "payments"],
      content:
        "Customers can add items to a cart, adjust quantities, enter shipping details, and pay by card through Stripe Checkout. A successful payment creates an order and shows a confirmation page.",
    }),
    node({
      id: "tpl_sales_req_orders",
      canvasType: "requirement",
      title: "Order Management",
      x: 555,
      y: 360,
      tags: ["admin", "backend"],
      content:
        "Admins can view new orders, filter by status, update status to processing, shipped, or delivered, and resend confirmation emails. Customers can see order history after logging in.",
    }),
    node({
      id: "tpl_sales_req_handoff",
      canvasType: "requirement",
      title: "Client Handoff Output",
      x: 100,
      y: 470,
      tags: ["client-facing", "handoff"],
      content:
        "Final handoff should include the agreed scope, excluded items, admin user guide, payment provider setup checklist, launch checklist, QA notes, and a short backlog of phase 2 ideas.",
    }),
  ],
  edges: [
    edge({ id: "tpl_sales_edge_brief_contract", source: "tpl_sales_client_brief", target: "tpl_sales_contract", relationship: "requirement source" }),
    edge({ id: "tpl_sales_edge_estimate_contract", source: "tpl_sales_estimate", target: "tpl_sales_contract", relationship: "references" }),
    edge({ id: "tpl_sales_edge_wireframe_contract", source: "tpl_sales_wireframe", target: "tpl_sales_contract", relationship: "design reference" }),
    edge({ id: "tpl_sales_edge_catalog_contract", source: "tpl_sales_contract", target: "tpl_sales_req_catalog", relationship: "implements" }),
    edge({ id: "tpl_sales_edge_checkout_contract", source: "tpl_sales_contract", target: "tpl_sales_req_cart_checkout", relationship: "implements" }),
    edge({ id: "tpl_sales_edge_orders_contract", source: "tpl_sales_contract", target: "tpl_sales_req_orders", relationship: "implements" }),
    edge({ id: "tpl_sales_edge_handoff_contract", source: "tpl_sales_contract", target: "tpl_sales_req_handoff", relationship: "implements" }),
  ],
};

const APPOINTMENT_BOOKING_TEMPLATE: ProjectTemplate = {
  id: "appointment-booking",
  name: "Appointment Booking Portal",
  description: "Simple web portal for booking, managing, and reminding appointments.",
  defaultProjectName: "Appointment Booking Portal",
  projectDescription: "Sample client contract for a service business booking portal.",
  viewport: { x: 120, y: 90, zoom: 0.82 },
  nodes: [
    node({
      id: "tpl_booking_contract",
      canvasType: "project_contract",
      title: "Appointment Booking Portal Contract",
      x: 80,
      y: 80,
      tags: ["client-contract", "source-of-truth"],
      content:
        "Build a web portal for a small clinic or service business so customers can book appointments without calling the front desk.\n\nScope includes public service selection, available time slots, customer booking form, confirmation email, staff calendar view, cancellation/reschedule flow, and basic staff management.\n\nPayments, insurance processing, telehealth video, multi-location routing, and complex resource scheduling are out of scope for the initial release.",
    }),
    node({
      id: "tpl_booking_client_brief",
      canvasType: "source_snapshot",
      title: "Operations Team Brief",
      x: -320,
      y: -20,
      tags: ["client", "operations"],
      content:
        "Operations brief: staff spend too much time answering calls and manually updating a shared calendar.\n\nThe team needs customers to pick a service, choose an open slot, receive confirmation, and cancel or reschedule with a clear cutoff policy.\n\nBusiness hours vary by staff member. Admin users should be able to block time for holidays or unavailable periods.",
    }),
    node({
      id: "tpl_booking_policy",
      canvasType: "source_snapshot",
      title: "Booking Policy Notes",
      x: -310,
      y: 300,
      tags: ["policy", "planning"],
      content:
        "Policy notes: appointments require name, email, phone, service, preferred staff member if applicable, and optional notes.\n\nCustomers can cancel or reschedule until 24 hours before the appointment. Staff should receive a daily schedule email every morning.",
    }),
    node({
      id: "tpl_booking_calendar_link",
      canvasType: "link",
      title: "Calendar Mockup Link",
      x: 80,
      y: -160,
      tags: ["design"],
      content:
        "https://example.com/booking-calendar-mockup\n\nPlaceholder for public booking flow, confirmation page, staff calendar, and admin availability mockups.",
    }),
    node({
      id: "tpl_booking_req_slots",
      canvasType: "requirement",
      title: "Availability And Slots",
      x: 540,
      y: -120,
      tags: ["calendar", "backend"],
      content:
        "System shows available appointment slots based on service duration, staff availability, blocked time, and business hours. Once a slot is booked, it cannot be double-booked.",
    }),
    node({
      id: "tpl_booking_req_booking",
      canvasType: "requirement",
      title: "Customer Booking Flow",
      x: 560,
      y: 120,
      tags: ["frontend", "customer"],
      content:
        "Customers choose a service, date, time, and optional staff member, then submit contact details. The app validates required fields and shows a confirmation number after booking.",
    }),
    node({
      id: "tpl_booking_req_staff",
      canvasType: "requirement",
      title: "Staff Calendar",
      x: 555,
      y: 360,
      tags: ["staff", "admin"],
      content:
        "Staff can view daily and weekly appointments, filter by staff member or service, mark appointments complete or no-show, and add internal notes visible only to staff.",
    }),
    node({
      id: "tpl_booking_req_notifications",
      canvasType: "requirement",
      title: "Confirmations And Reminders",
      x: 100,
      y: 470,
      tags: ["email", "notifications"],
      content:
        "Customers receive booking, cancellation, and reschedule emails. Reminder emails are sent 24 hours before the appointment. Staff receive a morning summary of the day schedule.",
    }),
  ],
  edges: [
    edge({ id: "tpl_booking_edge_brief_contract", source: "tpl_booking_client_brief", target: "tpl_booking_contract", relationship: "requirement source" }),
    edge({ id: "tpl_booking_edge_policy_contract", source: "tpl_booking_policy", target: "tpl_booking_contract", relationship: "references" }),
    edge({ id: "tpl_booking_edge_calendar_contract", source: "tpl_booking_calendar_link", target: "tpl_booking_contract", relationship: "design reference" }),
    edge({ id: "tpl_booking_edge_slots_contract", source: "tpl_booking_contract", target: "tpl_booking_req_slots", relationship: "implements" }),
    edge({ id: "tpl_booking_edge_flow_contract", source: "tpl_booking_contract", target: "tpl_booking_req_booking", relationship: "implements" }),
    edge({ id: "tpl_booking_edge_staff_contract", source: "tpl_booking_contract", target: "tpl_booking_req_staff", relationship: "implements" }),
    edge({ id: "tpl_booking_edge_notifications_contract", source: "tpl_booking_contract", target: "tpl_booking_req_notifications", relationship: "implements" }),
  ],
};

const RESTAURANT_ORDERING_TEMPLATE: ProjectTemplate = {
  id: "restaurant-ordering",
  name: "Restaurant Ordering Site",
  description: "Pickup ordering with menu, checkout, and kitchen order status.",
  defaultProjectName: "Restaurant Ordering Site",
  projectDescription: "Sample client contract for a small restaurant pickup ordering site.",
  viewport: { x: 120, y: 90, zoom: 0.82 },
  nodes: [
    node({
      id: "tpl_restaurant_contract",
      canvasType: "project_contract",
      title: "Restaurant Ordering Site Contract",
      x: 80,
      y: 80,
      tags: ["client-contract", "source-of-truth"],
      content:
        "Build a mobile-friendly website for a local restaurant to accept pickup orders directly from customers.\n\nScope includes online menu, item customization, cart, pickup time selection, card payment, order confirmation, kitchen order queue, and admin controls for menu availability.\n\nDelivery dispatch, loyalty rewards, table reservations, third-party marketplace integrations, and point-of-sale hardware integration are out of scope for the first release.",
    }),
    node({
      id: "tpl_restaurant_brief",
      canvasType: "source_snapshot",
      title: "Restaurant Owner Brief",
      x: -320,
      y: -20,
      tags: ["client", "brief"],
      content:
        "Owner brief: phone orders are hard to manage during lunch rush, and marketplace fees are too high.\n\nThe restaurant wants customers to order from the menu, pay online, pick a pickup time, and receive an order number. Kitchen staff need a simple queue they can keep open on a tablet.",
    }),
    node({
      id: "tpl_restaurant_menu",
      canvasType: "source_snapshot",
      title: "Menu And Prep Notes",
      x: -310,
      y: 300,
      tags: ["menu", "operations"],
      content:
        "Menu notes: each item has name, description, price, category, photo, availability, and optional modifiers such as size, spice level, toppings, or special instructions.\n\nPickup slots should be every 15 minutes during open hours, with a default prep time of 25 minutes.",
    }),
    node({
      id: "tpl_restaurant_design",
      canvasType: "link",
      title: "Ordering Flow Mockup",
      x: 80,
      y: -160,
      tags: ["design"],
      content:
        "https://example.com/restaurant-ordering-mockup\n\nPlaceholder for menu list, item customization modal, cart, checkout, order confirmation, and kitchen queue mockups.",
    }),
    node({
      id: "tpl_restaurant_req_menu",
      canvasType: "requirement",
      title: "Menu Browsing",
      x: 540,
      y: -120,
      tags: ["frontend", "menu"],
      content:
        "Customers can browse menu categories, view item details, select modifiers, add special instructions, and add items to cart. Unavailable items remain visible but cannot be ordered.",
    }),
    node({
      id: "tpl_restaurant_req_checkout",
      canvasType: "requirement",
      title: "Pickup Checkout",
      x: 560,
      y: 120,
      tags: ["checkout", "payments"],
      content:
        "Customers choose a pickup time, enter contact information, pay online, and receive a confirmation page and email with order number, pickup time, and restaurant address.",
    }),
    node({
      id: "tpl_restaurant_req_kitchen",
      canvasType: "requirement",
      title: "Kitchen Queue",
      x: 555,
      y: 360,
      tags: ["staff", "operations"],
      content:
        "Kitchen staff can view incoming orders ordered by pickup time, mark orders as accepted, ready, or completed, and see item modifiers and special instructions clearly.",
    }),
    node({
      id: "tpl_restaurant_req_admin",
      canvasType: "requirement",
      title: "Menu Admin",
      x: 100,
      y: 470,
      tags: ["admin", "backend"],
      content:
        "Admins can edit menu items, prices, photos, modifier groups, availability, open hours, and temporary closures. Changes should be visible to customers without redeploying the site.",
    }),
  ],
  edges: [
    edge({ id: "tpl_restaurant_edge_brief_contract", source: "tpl_restaurant_brief", target: "tpl_restaurant_contract", relationship: "requirement source" }),
    edge({ id: "tpl_restaurant_edge_menu_contract", source: "tpl_restaurant_menu", target: "tpl_restaurant_contract", relationship: "references" }),
    edge({ id: "tpl_restaurant_edge_design_contract", source: "tpl_restaurant_design", target: "tpl_restaurant_contract", relationship: "design reference" }),
    edge({ id: "tpl_restaurant_edge_menu_req_contract", source: "tpl_restaurant_contract", target: "tpl_restaurant_req_menu", relationship: "implements" }),
    edge({ id: "tpl_restaurant_edge_checkout_contract", source: "tpl_restaurant_contract", target: "tpl_restaurant_req_checkout", relationship: "implements" }),
    edge({ id: "tpl_restaurant_edge_kitchen_contract", source: "tpl_restaurant_contract", target: "tpl_restaurant_req_kitchen", relationship: "implements" }),
    edge({ id: "tpl_restaurant_edge_admin_contract", source: "tpl_restaurant_contract", target: "tpl_restaurant_req_admin", relationship: "implements" }),
  ],
};

const CUSTOMER_SUPPORT_TEMPLATE: ProjectTemplate = {
  id: "customer-support-portal",
  name: "Customer Support Portal",
  description: "Simple help desk portal with tickets, FAQ, and staff responses.",
  defaultProjectName: "Customer Support Portal",
  projectDescription: "Sample client contract for a lightweight support portal.",
  viewport: { x: 120, y: 90, zoom: 0.82 },
  nodes: [
    node({
      id: "tpl_support_contract",
      canvasType: "project_contract",
      title: "Customer Support Portal Contract",
      x: 80,
      y: 80,
      tags: ["client-contract", "source-of-truth"],
      content:
        "Build a lightweight customer support portal for a SaaS client so customers can find answers and submit support tickets.\n\nScope includes public FAQ articles, authenticated ticket submission, ticket status tracking, email notifications, staff inbox, internal notes, and a basic admin area for FAQ content.\n\nLive chat, phone support routing, AI auto-replies, SLA automation, and integration with enterprise help desk tools are out of scope for phase 1.",
    }),
    node({
      id: "tpl_support_brief",
      canvasType: "source_snapshot",
      title: "Support Team Brief",
      x: -320,
      y: -20,
      tags: ["client", "support"],
      content:
        "Support brief: customer questions are currently split across email and spreadsheets. The team needs a single place to collect requests and share common answers.\n\nCustomers should see ticket progress without emailing repeatedly. Staff should be able to assign tickets and leave private notes.",
    }),
    node({
      id: "tpl_support_content",
      canvasType: "source_snapshot",
      title: "FAQ Content Plan",
      x: -310,
      y: 300,
      tags: ["content", "planning"],
      content:
        "FAQ content plan: launch with 20-30 common questions organized by category. Articles need title, category, answer body, published status, and last updated date.\n\nTicket categories: Billing, Account Access, Bug Report, Feature Question, and General Help.",
    }),
    node({
      id: "tpl_support_mockup",
      canvasType: "link",
      title: "Support Portal Mockup",
      x: 80,
      y: -160,
      tags: ["design"],
      content:
        "https://example.com/support-portal-mockup\n\nPlaceholder for FAQ list, article page, ticket form, customer ticket detail, and staff inbox mockups.",
    }),
    node({
      id: "tpl_support_req_faq",
      canvasType: "requirement",
      title: "FAQ Knowledge Base",
      x: 540,
      y: -120,
      tags: ["content", "frontend"],
      content:
        "Visitors can browse and search published FAQ articles by category. Admins can create, edit, draft, publish, and archive articles from a simple content screen.",
    }),
    node({
      id: "tpl_support_req_tickets",
      canvasType: "requirement",
      title: "Ticket Submission",
      x: 560,
      y: 120,
      tags: ["customer", "backend"],
      content:
        "Logged-in customers can submit a ticket with category, subject, message, priority, and optional attachments. The customer receives an email confirmation with the ticket number.",
    }),
    node({
      id: "tpl_support_req_status",
      canvasType: "requirement",
      title: "Ticket Status Tracking",
      x: 555,
      y: 360,
      tags: ["customer", "notifications"],
      content:
        "Customers can view their ticket list and ticket details, including status, staff replies, and attachment history. Email notifications are sent when staff replies or changes status.",
    }),
    node({
      id: "tpl_support_req_staff",
      canvasType: "requirement",
      title: "Staff Inbox",
      x: 100,
      y: 470,
      tags: ["staff", "admin"],
      content:
        "Support staff can filter tickets by status, category, priority, and assignee. Staff can reply to customers, add private internal notes, assign tickets, and close resolved tickets.",
    }),
  ],
  edges: [
    edge({ id: "tpl_support_edge_brief_contract", source: "tpl_support_brief", target: "tpl_support_contract", relationship: "requirement source" }),
    edge({ id: "tpl_support_edge_content_contract", source: "tpl_support_content", target: "tpl_support_contract", relationship: "references" }),
    edge({ id: "tpl_support_edge_mockup_contract", source: "tpl_support_mockup", target: "tpl_support_contract", relationship: "design reference" }),
    edge({ id: "tpl_support_edge_faq_contract", source: "tpl_support_contract", target: "tpl_support_req_faq", relationship: "implements" }),
    edge({ id: "tpl_support_edge_tickets_contract", source: "tpl_support_contract", target: "tpl_support_req_tickets", relationship: "implements" }),
    edge({ id: "tpl_support_edge_status_contract", source: "tpl_support_contract", target: "tpl_support_req_status", relationship: "implements" }),
    edge({ id: "tpl_support_edge_staff_contract", source: "tpl_support_contract", target: "tpl_support_req_staff", relationship: "implements" }),
  ],
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  BASIC_SALES_ECOMMERCE_TEMPLATE,
  APPOINTMENT_BOOKING_TEMPLATE,
  RESTAURANT_ORDERING_TEMPLATE,
  CUSTOMER_SUPPORT_TEMPLATE,
];
