#include lomo:shaders/lib/linear.glsl
#include frex:shaders/lib/math.glsl
#include canvas:shaders/pipeline/pipeline.glsl

uniform sampler2D u_color;
uniform sampler2D u_depth;

layout(location = 0) out vec3 out_color;

const int steps = 16;

vec2[steps] positions = vec2[steps](
	vec2(0.0, 0.0),
	vec2(0.45155564254657965, -0.03017467505069315),
	vec2(0.12198114664569583, 0.4660958518030005),
	vec2(-0.2540802678690903, -0.4271151489018215),
	vec2(-0.5082727949036007, 0.051563060356078806),
	vec2(0.19767560234451562, -0.47832565550123013),
	vec2(-0.34628204071358504, 0.4924769814454519),
	vec2(0.5814960793676434, 0.47045439538672074),
	vec2(-0.7106781925499065, -0.42074521162819145),
	vec2(0.7053171620878812, -0.48129857432490886),
	vec2(0.9064883723374269, 0.05279688894107594),
	vec2(-0.18180454330987472, 0.9302930180121719),
	vec2(0.36182626789974554, -0.8898355145773604),
	vec2(-0.9705384041463976, 0.1252040107855789),
	vec2(-0.8016074589017398, 0.5699335224337542),
	vec2(-0.11571062111632413, -0.9872730869865174)
);

void main() {
	##define DOF
	#ifdef DOF
	float depth0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).x;
	vec3 pos = vec3(gl_FragCoord.xy, depth0);
	//vec3 pos_cam0 = win_to_cam(pos);

	vec3 ndc_near = vec3(gl_FragCoord.xy, 0.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
	vec3 ndc_far  = vec3(gl_FragCoord.xy, 1.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;

	vec4 near0 = frx_inverseProjectionMatrix * vec4(ndc_near, 1.0);
	vec4 far0  = frx_inverseProjectionMatrix * vec4(ndc_far, 1.0);
	vec3 near = near0.xyz / near0.w;
	vec3 far  = far0.xyz  / far0.w;

	vec3 dir = normalize(far - near);

	float center_depth = textureLod(u_depth, vec2(0.5), 4).x;

	vec3 color = vec3(0.0);
	float weight_sum = 0.0;

	const float radius = 2.0;

	for(int stp = 0; stp < steps; ++stp) {
		vec2 off = positions[stp] * radius;
		ivec2 ipos = ivec2(gl_FragCoord.xy + off);
		float depth = texelFetch(u_depth, ipos, 0).x;
		vec3 color0 = texelFetch(u_color, ipos, 0).rgb;

		vec3 pos = vec3(gl_FragCoord.xy + off, depth);
		vec3 pos_cam = win_to_cam(pos);
		vec3 mid_cam = win_to_cam(vec3(pos.xy, center_depth));

		float dist_to_mid_z = distance(pos_cam, mid_cam);

		float radius0 =
			min(
				dist_to_mid_z * 0.01,
				radius
			);

		float weight =
			clamp(radius0 + 0.5 - length(off), 0.0, 1.0) *
			float(all(greaterThanEqual(ipos, ivec2(0)))) *
			float(all(lessThan(ipos, ivec2(frxu_size.xy))));

		color += color0 * weight;
		weight_sum += weight;
	}

	color /= weight_sum;

	out_color = vec3(color);
	#else
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	#endif
}