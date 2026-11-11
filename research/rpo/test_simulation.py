"""Meaningful model checks, not flight qualification."""
import unittest
import numpy as np

from simulate import (A, B, BD, DT, N, PHI, Config, command, inertial_to_relative,
                      matrix_exp, relative_to_inertial, run, target, truth_step,
                      update)


class ModelChecks(unittest.TestCase):
    def test_transition_matches_analytic_hcw(self):
        # Independent closed-form HCW transition, x radial / y along-track.
        for t in [1.0, 60.0, 300.0]:
            s, c = np.sin(N*t), np.cos(N*t)
            analytic = np.array([
                [4-3*c,0,0,s/N,2*(1-c)/N,0],
                [6*(s-N*t),1,0,-2*(1-c)/N,(4*s-3*N*t)/N,0],
                [0,0,c,0,0,s/N],
                [3*N*s,0,0,c,2*s,0],
                [-6*N*(1-c),0,0,-2*s,4*c-3,0],
                [0,0,-N*s,0,0,c],
            ])
            np.testing.assert_allclose(matrix_exp(A*t),analytic,rtol=1e-10,atol=1e-9)

    def test_input_discretization_matches_numerical_quadrature(self):
        # Simpson integration of exp(A*t) B over the interval.
        ts=np.linspace(0,DT,101)
        weights=np.ones(101);weights[1:-1:2]=4;weights[2:-1:2]=2
        integral=sum(w*(matrix_exp(A*t)@B) for t,w in zip(ts,weights))*(DT/100)/3
        np.testing.assert_allclose(BD,integral,rtol=1e-10,atol=1e-12)

    def test_frame_round_trip(self):
        relative=np.array([3.,-120.,2.,.01,.3,-.02])
        for t in [0.,100.,650.]:
            restored=inertial_to_relative(relative_to_inertial(relative,t),t)
            np.testing.assert_allclose(restored,relative,atol=2e-9,rtol=0)

    def test_nonlinear_truth_tracks_analytic_circular_orbit(self):
        r,v=target(0.)
        state=np.r_[r,v]
        for t in range(650): state=truth_step(state,float(t),np.zeros(3))
        rt,vt=target(650.)
        self.assertLess(np.linalg.norm(state[:3]-rt),1e-4)
        self.assertLess(np.linalg.norm(state[3:]-vt),1e-7)

    def test_truth_integration_step_convergence(self):
        initial=relative_to_inertial(np.array([2.,-120.,1.,.01,.25,0.]))
        full,half=initial.copy(),initial.copy()
        accel=np.array([.001,.002,-.001])
        for t in range(300):
            full=truth_step(full,t,accel)
            half=truth_step(half,t,accel,0.5)
            half=truth_step(half,t+0.5,accel,0.5)
        self.assertLess(np.linalg.norm(full[:3]-half[:3]),1e-4)

    def test_controller_changes_with_estimated_velocity(self):
        mean=np.array([0.,-60.,0.,0.,0.,0.])
        p=np.eye(6)*.001
        a,*_=command(mean,p,0.,'APPROACH','OK',Config())
        mean[4]=.25
        b,*_=command(mean,p,0.,'APPROACH','OK',Config())
        self.assertGreater(np.linalg.norm(a-b),.001)

    def test_stale_measurement_latches_retreat(self):
        mean=np.array([0.,-60.,0.,0.,.2,0.])
        _,mode,reason,_=command(mean,np.eye(6)*.001,6.,'APPROACH','OK',Config())
        self.assertEqual(mode,'RETREAT')
        self.assertIn('stale',reason)
        _,mode,_,_=command(mean,np.eye(6)*.001,0.,mode,'OK',Config())
        self.assertEqual(mode,'RETREAT')

    def test_wrong_track_rejected_without_mutating_estimate(self):
        mean=np.array([0.,-60.,0.,0.,.2,0.])
        p=np.eye(6)*.01
        changed,cov,accepted,nis=update(mean,p,np.array([20.,-60.,0.]),np.eye(3)*.01,16.27)
        self.assertFalse(accepted)
        np.testing.assert_array_equal(changed,mean)
        np.testing.assert_array_equal(cov,p)
        self.assertGreater(nis,16.27)

    def test_nominal_and_fault_outcomes_are_distinguished(self):
        nominal=run('nominal',7)
        lost=run('control_loss',7)
        self.assertEqual(nominal['outcome'],'HOLD REACHED')
        self.assertEqual(lost['outcome'],'CONTROL LOST')
        self.assertIsNotNone(lost['retreat_time_s'])

    def test_seeded_run_reproducible(self):
        a=run('sensor_loss',11)
        b=run('sensor_loss',11)
        self.assertEqual(a,b)

    def test_health_feedback_changes_degraded_case_not_loss_of_control(self):
        before=run('weak_thrust',7,Config(health_aware=False))
        after=run('weak_thrust',7,Config(health_aware=True))
        self.assertEqual(before['outcome'],'RETREAT INCOMPLETE')
        self.assertEqual(after['outcome'],'RETREATED')
        self.assertLess(after['position_rmse_m'],before['position_rmse_m']/10)
        self.assertEqual(run('control_loss',7)['outcome'],'CONTROL LOST')


if __name__=='__main__': unittest.main(verbosity=2)
