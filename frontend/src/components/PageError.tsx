import { Alert, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function PageError({ error }: { error: Error }) {
  const navigate = useNavigate();
  return (
    <Alert severity="error" action={<Button color="inherit" onClick={() => navigate(-1)}>Go back</Button>}>
      {error.message}
    </Alert>
  );
}
