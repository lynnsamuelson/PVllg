import { useState } from "react";
import * as api from "../../api/client.js";
import AppHeader from "../../components/AppHeader.jsx";
import Badge from "../../components/Badge.jsx";
import Button from "../../components/Button.jsx";
import Chip from "../../components/Chip.jsx";
import FieldError from "../../components/FieldError.jsx";
import TextField from "../../components/TextField.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

// Keys match the API (accounts.OrganizationProfileSerializer) and resources.models.SERVES.
const SERVES = [
  { value: "parents", label: "New parents" },
  { value: "foster", label: "Foster families" },
  { value: "kinship", label: "Kinship caregivers" },
];

// Mock Up 9. Behind <RequireVerifiedOrg>, so user.organization is Verified here.
export default function OrgProfilePage() {
  const { user, updateUser } = useAuth();
  const org = user.organization;
  const [form, setForm] = useState({
    about: org.about || "",
    serves: org.serves || [],
    pickup_address: org.pickup_address || "",
    public_contact: org.public_contact || "",
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setMessage("");
    setSaved(false);
  };
  const toggleServe = (value) =>
    set("serves", form.serves.includes(value) ? form.serves.filter((s) => s !== value) : [...form.serves, value]);

  const onSave = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage("");
    setSaved(false);
    setSaving(true);
    try {
      updateUser(await api.saveOrgProfile(form));
      setSaved(true);
    } catch (err) {
      const fields = err.fields || {};
      setErrors(fields);
      setMessage(Object.keys(fields).length ? "Your profile wasn't saved." : `Your profile wasn't saved. ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <AppHeader>{org.name}</AppHeader>
      <form onSubmit={onSave} className="stack" noValidate>
        <div>
          <Badge variant="verified">Verified</Badge>
        </div>
        <TextField
          label="About us"
          multiline
          rows={3}
          maxLength={500}
          placeholder="We share diapers and baby clothes with families in Davidson County."
          value={form.about}
          onChange={(e) => set("about", e.target.value)}
          errors={errors.about}
        />
        <p className="field-label" id="serves-label">
          Who we serve
        </p>
        <div role="group" aria-labelledby="serves-label" className="chips">
          {SERVES.map((s) => (
            <Chip key={s.value} multiple selected={form.serves.includes(s.value)} onSelect={() => toggleServe(s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
        <FieldError messages={errors.serves} />
        <TextField
          label="Public pickup address"
          autoComplete="street-address"
          placeholder="123 Example St, Nashville, TN 37206"
          value={form.pickup_address}
          onChange={(e) => set("pickup_address", e.target.value)}
          hint="Use your organization's address, not a person's home. It helps families find you nearby."
          errors={errors.pickup_address}
        />
        <TextField
          label="Public contact"
          placeholder="info@samplecommunitycloset.org"
          value={form.public_contact}
          onChange={(e) => set("public_contact", e.target.value)}
          errors={errors.public_contact}
        />
        {saved && (
          <p role="status" className="saved">
            Saved
          </p>
        )}
        {message && (
          <p role="alert" className="form-error">
            {message}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          Save profile
        </Button>
      </form>
    </section>
  );
}
