import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import * as api from "../../api/client.js";
import Button from "../../components/Button.jsx";
import Checkbox from "../../components/Checkbox.jsx";
import FieldError from "../../components/FieldError.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import ProgressBar from "../../components/ProgressBar.jsx";
import TextField from "../../components/TextField.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

// Keys match the API (items.models.CATEGORIES).
const CATEGORIES = [
  { value: "clothes", label: "Clothes & gear" },
  { value: "diapers", label: "Diapers & wipes" },
  { value: "feeding", label: "Feeding supplies" },
  { value: "furniture", label: "Furniture" },
  { value: "other", label: "Other approved item" },
];
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const EMPTY = {
  name: "",
  category: "",
  details: "",
  quantity: "1",
  good_condition: false,
  not_recalled: false,
  pickup_date: "",
  pickup_start: "",
  pickup_end: "",
  general_area: "",
  exact_address: "",
  where_to_go: "",
  what_to_bring: "",
};
const STEP_1_FIELDS = ["name", "category", "details", "quantity", "good_condition", "not_recalled", "photos"];

// Which required answers are missing on a step, as { field: [message] }.
function missing(step, form, isOrg) {
  const errors = {};
  const need = (ok, field, message) => {
    if (!ok) errors[field] = [message];
  };
  if (step === 0) {
    need(form.name.trim(), "name", "Add the item name.");
    need(form.category, "category", "Pick a category.");
    need(form.details.trim(), "details", "Add the details.");
    need(Number(form.quantity) >= 1 && Number.isInteger(Number(form.quantity)), "quantity", "Enter how many, 1 or more.");
    need(form.good_condition && form.not_recalled, "boxes", "Check both boxes to post.");
  } else {
    need(form.pickup_date, "pickup_date", "Pick the pickup date.");
    need(form.pickup_start && form.pickup_end, "pickup_end", "Pick the time window.");
    need(form.general_area.trim(), "general_area", "Add the general area.");
    if (!isOrg) need(form.exact_address.trim(), "exact_address", "Add the exact address.");
  }
  return errors;
}


// Mock Ups 19-20. Behind <RequireGiver>: a Verified organization or a person with Give support.
// With an :itemId in the URL it is Edit (KAN-10): the same form, filled in, without photos.
// Keyed by the item so moving between /items/new and an Edit starts from a fresh form.
export default function PostItemPage() {
  const { itemId } = useParams();
  return <ItemForm key={itemId ?? "new"} itemId={itemId} />;
}

function ItemForm({ itemId }) {
  const { user } = useAuth();
  const isOrg = user.account_type === "organization";
  const orgAddress = isOrg ? user.organization.pickup_address : "";
  const listRoute = isOrg ? ROUTES.orgItems : ROUTES.give;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [posted, setPosted] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(!itemId);
  const [next, setNext] = useState(null);

  useEffect(() => {
    if (!itemId) return;
    api
      .getMyItem(itemId)
      .then((item) => {
        // The same answers as posting; it was posted with both boxes checked, so they come back checked.
        const answers = Object.fromEntries(Object.keys(EMPTY).map((f) => [f, item[f] ?? ""]));
        setForm({
          ...answers,
          quantity: String(item.quantity),
          pickup_start: item.pickup_start.slice(0, 5),
          pickup_end: item.pickup_end.slice(0, 5),
          good_condition: true,
          not_recalled: true,
        });
        setLoaded(true);
      })
      .catch((err) => setLoadError(err.message));
  }, [itemId]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const addPhotos = (e) => {
    const picked = [...e.target.files];
    e.target.value = "";
    const tooBig = picked.filter((p) => p.size > MAX_PHOTO_BYTES);
    const all = [...photos, ...picked.filter((p) => p.size <= MAX_PHOTO_BYTES)];
    const messages = [
      ...tooBig.map((p) => `${p.name} is too big. Use photos under 5 MB.`),
      ...(all.length > MAX_PHOTOS ? [`Add up to ${MAX_PHOTOS} photos.`] : []),
    ];
    setErrors((x) => ({ ...x, photos: messages }));
    setPhotos(all.slice(0, MAX_PHOTOS));
  };

  const removePhoto = (i) => {
    setPhotos(photos.filter((_, j) => j !== i));
    setErrors((x) => ({ ...x, photos: [] }));
  };

  const back = () => {
    setErrors({});
    setSaveError("");
    setStep(0);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const stepErrors = missing(step, form, isOrg);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) return;
    if (step === 0) {
      setStep(1);
      return;
    }
    setSaveError("");
    setSaving(true);
    try {
      const { exact_address, ...rest } = form;
      const fields = isOrg ? rest : form;
      if (itemId) {
        const item = await api.editItem(itemId, fields);
        setNext({ pathname: listRoute, state: { saved: item.name } });
        return;
      }
      setPosted(await api.postItem(fields, photos));
    } catch (err) {
      const fields = err.fields || {};
      setErrors(fields);
      setSaveError(`${itemId ? "Your changes weren't saved." : "Your item wasn't posted."} ${err.message}`);
      if (STEP_1_FIELDS.some((f) => f in fields)) setStep(0);
    } finally {
      setSaving(false);
    }
  };

  const postAnother = () => {
    setForm(EMPTY);
    setPhotos([]);
    setErrors({});
    setStep(0);
    setPosted(null);
  };

  if (next) return <Navigate to={next.pathname} state={next.state} replace />;

  if (loadError) {
    return (
      <section className="stack">
        <h1>Edit item</h1>
        <p className="form-error" role="alert">
          This item couldn't load. {loadError}
        </p>
        <Button variant="outline" to={listRoute}>
          My items
        </Button>
      </section>
    );
  }
  if (!loaded) return <p>Loading…</p>;

  if (posted) {
    return (
      <section className="stack">
        <h1>Posted</h1>
        <p role="status">{posted.name} is posted for pickup in {posted.general_area}.</p>
        <Button onClick={postAnother}>Post another item</Button>
        <Button variant="outline" to={listRoute}>
          My items
        </Button>
      </section>
    );
  }

  return (
    <section>
      <div className="back-header">
        {step === 0 ? (
          <Link to={listRoute} className="back-link">
            ← Back
          </Link>
        ) : (
          <button type="button" className="back-link" onClick={back}>
            ← Back
          </button>
        )}
        <h1>{itemId ? "Edit item" : "Post an item"}</h1>
      </div>
      <form onSubmit={onSubmit} className="stack" noValidate>
        <ProgressBar step={step + 1} total={2} title={step === 0 ? "About the item" : "Pickup details"} />

        {step === 0 && (
          <>
            <TextField
              label="Item name"
              maxLength={100}
              placeholder="Baby clothes bundle, 0-3 mo"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              errors={errors.name}
            />
            <TextField
              label="Category"
              options={CATEGORIES}
              placeholder="Pick a category"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              errors={errors.category}
            />
            <TextField
              label="Details"
              multiline
              rows={3}
              maxLength={1000}
              placeholder="Brand, size, age range, and condition. Example: 6 pieces, washed, no stains."
              value={form.details}
              onChange={(e) => set("details", e.target.value)}
              errors={errors.details}
            />
            <TextField
              label="How many?"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              errors={errors.quantity}
            />
            {!itemId && (
              <div className="field">
                <label className="photo-picker">
                  <span className="field-label">Photos (add up to 4)</span>
                  <span className="photo-picker-box">+ Add photos</span>
                  <input
                    aria-describedby="photo-hint"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={photos.length >= MAX_PHOTOS}
                    onChange={addPhotos}
                  />
                </label>
                <small id="photo-hint" className="hint">
                  Anyone signed in can see photos. Leave out house numbers and street signs.
                </small>
                {photos.length > 0 && (
                  <ul className="photo-list">
                    {photos.map((p, i) => (
                      <li key={`${p.name}-${i}`}>
                        {p.name}{" "}
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => removePhoto(i)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <FieldError messages={errors.photos} />
              </div>
            )}
            <div className="checkbox-list">
              <Checkbox
                label="This item is in good condition"
                checked={form.good_condition}
                onChange={(on) => set("good_condition", on)}
              />
              <Checkbox
                label="I checked that it is not recalled"
                checked={form.not_recalled}
                onChange={(on) => set("not_recalled", on)}
              />
              <FieldError messages={errors.boxes || errors.good_condition || errors.not_recalled} />
            </div>
            <NoteBox>Not allowed: breastmilk, medicine, and other health-sensitive items.</NoteBox>
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
            <Button type="submit">Next: pickup details</Button>
          </>
        )}

        {step === 1 && (
          <>
            <fieldset className="checkbox-list">
              <legend className="field-label">Pickup date and time window</legend>
              <TextField
                label="Date"
                type="date"
                value={form.pickup_date}
                onChange={(e) => set("pickup_date", e.target.value)}
                errors={errors.pickup_date}
              />
              <div className="row">
                <TextField
                  label="From"
                  type="time"
                  value={form.pickup_start}
                  onChange={(e) => set("pickup_start", e.target.value)}
                  errors={errors.pickup_start}
                />
                <TextField
                  label="To"
                  type="time"
                  value={form.pickup_end}
                  onChange={(e) => set("pickup_end", e.target.value)}
                  errors={errors.pickup_end}
                />
              </div>
            </fieldset>
            <TextField
              label="General area (shown to everyone)"
              maxLength={100}
              placeholder="East Nashville"
              value={form.general_area}
              onChange={(e) => set("general_area", e.target.value)}
              errors={errors.general_area}
            />
            {isOrg ? (
              orgAddress ? (
                <TextField label="Public pickup address" value={orgAddress} readOnly hint="From your organization profile." />
              ) : (
                <>
                  <NoteBox>Add your public pickup address to your organization profile first.</NoteBox>
                  <Button variant="outline" to={ROUTES.orgProfile}>
                    Organization profile
                  </Button>
                </>
              )
            ) : (
              <TextField
                label="Exact address (private until you approve)"
                autoComplete="street-address"
                maxLength={255}
                placeholder="Enter address"
                value={form.exact_address}
                onChange={(e) => set("exact_address", e.target.value)}
                errors={errors.exact_address}
              />
            )}
            <TextField
              label="Where to go"
              maxLength={200}
              placeholder="Front porch. Look for the blue bin."
              value={form.where_to_go}
              onChange={(e) => set("where_to_go", e.target.value)}
              errors={errors.where_to_go}
            />
            <TextField
              label="What to bring or know"
              multiline
              rows={3}
              maxLength={500}
              placeholder="Bring a bag. Please arrive within the time window."
              value={form.what_to_bring}
              onChange={(e) => set("what_to_bring", e.target.value)}
              errors={errors.what_to_bring}
            />
            <NoteBox>
              Tip: porch or public-place pickups are safest. Organizations: your public address is filled in for you.
            </NoteBox>
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
            <Button type="submit" disabled={saving || (isOrg && !orgAddress)}>
              {itemId ? "Save changes" : "Post item"}
            </Button>
          </>
        )}
      </form>
    </section>
  );
}
