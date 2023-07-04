import { RoutesInput } from "../types/types"
import UserController from "../controllers/User.controller"
import algorithmService from "../services/algorithm.service"
export default ({ app }: RoutesInput) => {
  app.post("/api/user", async (req, res) => {
    const user = await UserController.CreateUser({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
    })
    return res.send({ user })
  })

  app.get("/api/algorithm", async (req, res) => {
    const response = await algorithmService.Dijkstra({
      start: req.body.start,
      end: req.body.end,
      options: req.body.options,
    })
    return res.send({ response })
  })
}