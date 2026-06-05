// CaroSpecs mobile — router + device frame. Bottom nav, account top corner.
const { useState: useStateApp2 } = React;

function MobileToast({ msg }) {
  if (!msg) return null;
  return (
    <div className="fade-up" style={{
      position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)", zIndex: 80,
      display: "flex", alignItems: "center", gap: 8, background: "#272F42", border: "1px solid #334155",
      borderRadius: 12, padding: "11px 18px", fontSize: 13.5, fontWeight: 500, color: "#F8FAFC",
      boxShadow: "0 16px 36px -14px rgba(0,0,0,0.7)", whiteSpace: "nowrap",
    }}>
      <window.Icon name="CircleCheck" size={16} color="#22C55E" /> {msg}
    </div>
  );
}

function MobileApp() {
  const [authed, setAuthed] = useStateApp2(false);
  const [screen, setScreen] = useStateApp2("overview");
  const [listing, setListing] = useStateApp2(null);
  const [grade, setGrade] = useStateApp2("Good");
  const [vehicle, setVehicle] = useStateApp2(null);
  const [back, setBack] = useStateApp2("overview");      // where detail/vehicle returns to
  const [acctBack, setAcctBack] = useStateApp2("overview");
  const [toast, setToast] = useStateApp2(null);

  const S1 = window.MobileScreens1, S2 = window.MobileScreens2, S3 = window.MobileScreens3;
  function showToast(m) { setToast(m); clearTimeout(window.__mt); window.__mt = setTimeout(() => setToast(null), 2000); }
  function openAccount() { setAcctBack(screen); setScreen("account"); }
  function openVehicle(v, from) { setVehicle(v); setBack(from || screen); setScreen("vehicle"); }
  function openPart(l, from) { setListing(l); setGrade(l.grade); setBack(from || screen); setScreen("detail"); }

  const tabScreens = ["overview", "browse", "add", "photos", "aichat", "messages"];
  const showTabs = authed && tabScreens.includes(screen);

  let content;
  if (!authed) {
    content = <S1.MSignIn onAuth={() => { setAuthed(true); setScreen("overview"); }} />;
  } else if (screen === "overview") {
    content = <S1.MOverview onNav={setScreen} onAccount={openAccount} onVehicle={(v) => openVehicle(v, "overview")} />;
  } else if (screen === "browse") {
    content = <S3.MBrowse onAccount={openAccount} onVehicle={(v) => openVehicle(v, "browse")} onPart={(l) => openPart(l, "browse")} />;
  } else if (screen === "add") {
    content = <S1.MCapture onAccount={openAccount} onCapture={() => setScreen("review")} />;
  } else if (screen === "review") {
    content = <S2.MReview onBack={() => setScreen("add")} onConfirm={(g) => { setGrade(g); setListing({ ...window.LISTINGS[0], grade: g, status: "Draft" }); setBack("add"); setScreen("detail"); }} />;
  } else if (screen === "detail") {
    content = <S2.MListingDetail listing={listing} grade={grade} onToast={showToast} onBack={() => setScreen(back)} />;
  } else if (screen === "vehicle") {
    content = <S3.MVehicleProfile v={vehicle} onBack={() => setScreen(back)} onPart={(l) => openPart(l, "vehicle")} onToast={showToast} />;
  } else if (screen === "photos") {
    content = <S3.MPhotos onAccount={openAccount} />;
  } else if (screen === "aichat") {
    content = <S3.MAIChat onAccount={openAccount} />;
  } else if (screen === "messages") {
    content = <S2.MMessages />;
  } else if (screen === "account") {
    content = <S2.MAccount onBack={() => setScreen(acctBack)} onSignOut={() => { setAuthed(false); setScreen("overview"); }} />;
  }

  return (
    <window.IOSDevice dark>
      <div style={{ height: "100%", background: "#0F172A" }}>{content}</div>
      {showTabs && <S1.MTabBar active={screen} onNav={setScreen} />}
      <MobileToast msg={toast} />
    </window.IOSDevice>
  );
}

window.MobileApp = MobileApp;
