import { ArrowUpRight } from "lucide-react";

const guides = [
  { id: "dashboard", title: "Overview", purpose: "Start here for device counts, toner alerts, and quick links to inventory.", connection: "Summarizes records from the equipment and toner modules." },
  { id: "members", title: "Team members", purpose: "Create the people directory and keep employee details current.", connection: "Members can be linked to computers, email accounts, SAP users, and Microsoft 365 installations. Administrators can link MIS login accounts to members." },
  { id: "computers", title: "Computers & laptops", purpose: "Register each device, its owner, location, status, and network address.", connection: "A device can link to a team member, printer, IP address, and Microsoft 365 installation." },
  { id: "printers", title: "Printers", purpose: "Track printers, connection type, location, status, and compatible cartridge.", connection: "Computers can reference a printer. Toner replacements connect a printer to a cartridge and record usage." },
  { id: "toners", title: "Toner inventory", purpose: "Record cartridge stock, minimum levels, and replacements.", connection: "Printers reference compatible toner. Recording a replacement reduces stock and preserves replacement history." },
  { id: "ip", title: "IP addresses", purpose: "Check address availability and record static, DHCP, or reserved assignments.", connection: "Assignments can point to registered equipment; device records also show their IP address. This is inventory tracking, not network configuration." },
  { id: "access-points", title: "Access points", purpose: "Record Wi-Fi equipment, management IP, SSID, location, and status.", connection: "Management IPs participate in the same address overview as other devices." },
  { id: "emails", title: "Email accounts", purpose: "Track individual mailboxes, shared mailboxes, and aliases.", connection: "Assign accounts to members, add shared mailbox members, and link aliases to a parent mailbox. Records do not provision or send email." },
  { id: "microsoft-365", title: "Microsoft 365", purpose: "Track shared installation accounts in batches of five active slots.", connection: "Each slot links a team member and a registered computer or an external device description. Releasing a slot keeps its history." },
  { id: "sap-users", title: "SAP Users", purpose: "Keep SAP IDs, departments, validity dates, and dealership assignments in one directory.", connection: "A SAP user can link to one team member across the shared directory. This module does not store SAP passwords." },
  { id: "credentials", title: "My credentials", purpose: "Save your own recoverable account credentials in the encrypted vault.", connection: "Credentials belong to the signed-in person and are separate from email, SAP, and Microsoft 365 inventory records." },
  { id: "profile", title: "My profile", purpose: "Review your details and assigned equipment and accounts.", connection: "Your profile gathers links created in the member, device, email, and Microsoft 365 modules." },
];

export default function Tutorial({ onOpen, canSeeIp }: { onOpen: (id: string) => void; canSeeIp: boolean }) {
  return (
    <div className="tutorial">
      <section className="tutorial-intro">
        <div className="tutorial-kicker">GETTING STARTED</div>
        <h2>Follow the record from person to equipment to access.</h2>
        <p>Choose the dealership workspace first. Add a team member, register their equipment, then link the accounts and services they use. Open any module below to follow along.</p>
        <div className="tutorial-flow" aria-label="Typical setup order">
          <span>Team member</span><span aria-hidden="true">→</span><span>Device & network</span><span aria-hidden="true">→</span><span>Email, SAP & Microsoft 365</span>
        </div>
      </section>
      <div className="tutorial-grid">
        {guides.filter((guide) => canSeeIp || guide.id !== "ip").map((guide, index) => (
          <article className="tutorial-card" key={guide.id}>
            <div className="tutorial-card-top"><span>{String(index + 1).padStart(2, "0")}</span><h3>{guide.title}</h3></div>
            <p>{guide.purpose}</p>
            <div className="tutorial-connection"><strong>How it connects</strong><p>{guide.connection}</p></div>
            <button type="button" onClick={() => onOpen(guide.id)}>Open {guide.title}<ArrowUpRight size={15} /></button>
          </article>
        ))}
      </div>
      <section className="tutorial-note"><strong>Who can make changes?</strong> Administrators manage logins and roles. IT staff and administrators maintain most records. Members can manage their own profile and credentials. The selected dealership controls which inventory you can edit; the team member, email, and SAP directories can be browsed across dealerships.</section>
    </div>
  );
}
